import asyncio
import json
import os
from typing import Any, Dict, Literal, Optional, Tuple, TypedDict, Union
from urllib.parse import unquote

import jwt as pyjwt
from fastapi import HTTPException
from starlette.requests import cookie_parser
from typing_extensions import TypeAlias

from chainlit.auth import (
    get_current_user,
    get_token_from_cookies,
    require_login,
)
from chainlit.auth.jwt import decode_jwt
from chainlit.chat_context import chat_context
from chainlit.config import ChainlitConfig, config
from chainlit.context import init_ws_context
from chainlit.data import get_data_layer
from chainlit.logger import logger
from chainlit.message import ErrorMessage, Message
from chainlit.server import sio
from chainlit.session import ClientType, WebsocketSession
from chainlit.types import (
    InputAudioChunk,
    InputAudioChunkPayload,
    MessagePayload,
)
from chainlit.user import PersistedUser, User
from chainlit.user_session import user_sessions

WSGIEnvironment: TypeAlias = dict[str, Any]


class WebSocketSessionAuth(TypedDict):
    sessionId: str
    userEnv: str | None
    clientType: ClientType
    chatProfile: str | None
    threadId: str | None


def _normalize_identifier(value: Any) -> str:
    """Normalize user identifiers for safe equality checks across auth sources."""
    return str(value or "").strip().casefold()


def _identifiers_match(left: Any, right: Any) -> bool:
    """Return whether two identifiers refer to the same logical user."""
    left_normalized = _normalize_identifier(left)
    right_normalized = _normalize_identifier(right)
    if not left_normalized or not right_normalized:
        return False
    return left_normalized == right_normalized

def _session_owner_matches_user(
    session: WebsocketSession, user: User | PersistedUser | None
) -> bool:
    if session.user is None and user is None:
        return True

    if session.user is None or user is None:
        return False

    return session.user.identifier == user.identifier


def restore_existing_session(
    sid,
    session_id,
    emit_fn,
    emit_call_fn,
    environ,
    user: User | PersistedUser | None = None,
):
    """Restore a session from the sessionId provided by the client."""
    if session := WebsocketSession.get_by_id(session_id):
        if not _session_owner_matches_user(session, user):
            logger.error("Authorization for the session failed.")
            raise ConnectionRefusedError("authorization failed")

        session.restore(new_socket_id=sid)
        session.emit = emit_fn
        session.emit_call = emit_call_fn
        session.environ = environ
        return True
    return False


async def persist_user_session(thread_id: str, metadata: Dict):
    if data_layer := get_data_layer():
        await data_layer.update_thread(thread_id=thread_id, metadata=metadata)


async def resume_thread(session: WebsocketSession):
    data_layer = get_data_layer()
    if not data_layer or not session.user or not session.thread_id_to_resume:
        return
    thread = await data_layer.get_thread(thread_id=session.thread_id_to_resume)
    if not thread:
        return

    author = thread.get("userIdentifier")
    user_is_author = author == session.user.identifier

    if user_is_author:
        metadata = thread.get("metadata") or {}
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        user_sessions[session.id] = metadata.copy()
        if chat_profile := metadata.get("chat_profile"):
            session.chat_profile = chat_profile
        if chat_settings := metadata.get("chat_settings"):
            session.chat_settings = chat_settings

        return thread


def load_user_env(user_env):
    if user_env:
        user_env_dict = json.loads(user_env)
    # Check user env
    if config.project.user_env:
        if not user_env_dict:
            raise ConnectionRefusedError("Missing user environment variables")
        # Check if requested user environment variables are provided
        for key in config.project.user_env:
            if key not in user_env_dict:
                raise ConnectionRefusedError(
                    "Missing user environment variable: " + key
                )
    return user_env_dict


def _get_token_from_cookie(environ: WSGIEnvironment) -> Optional[str]:
    if cookie_header := environ.get("HTTP_COOKIE", None):
        cookies = cookie_parser(cookie_header)
        return get_token_from_cookies(cookies)

    return None


def _get_token(environ: WSGIEnvironment) -> Optional[str]:
    """Take WSGI environ, return access token."""
    return _get_token_from_cookie(environ)


def _get_cookie_names(environ: WSGIEnvironment) -> list[str]:
    """Return parsed cookie names for authentication diagnostics."""
    if cookie_header := environ.get("HTTP_COOKIE", None):
        return sorted(cookie_parser(cookie_header).keys())
    return []


def _get_expected_auth_cookie_name() -> str:
    """Return the configured Chainlit auth cookie base name."""
    return os.environ.get("CHAINLIT_AUTH_COOKIE_NAME", "access_token")


def _get_request_location(environ: WSGIEnvironment) -> str:
    """Return the current host/path pair for websocket diagnostics."""
    host = environ.get("HTTP_HOST") or "unknown-host"
    path = environ.get("PATH_INFO") or "unknown-path"
    return f"{host}{path}"


def _get_request_source_summary(environ: WSGIEnvironment) -> str:
    """Return the most relevant request source headers for diagnostics."""
    return (
        f"origin={environ.get('HTTP_ORIGIN', 'none')}; "
        f"referer={environ.get('HTTP_REFERER', 'none')}; "
        f"user_agent={environ.get('HTTP_USER_AGENT', 'none')}; "
        f"remote_addr={environ.get('REMOTE_ADDR', 'none')}; "
        f"x_forwarded_for={environ.get('HTTP_X_FORWARDED_FOR', 'none')}; "
        f"x_forwarded_proto={environ.get('HTTP_X_FORWARDED_PROTO', 'none')}; "
        f"x_forwarded_host={environ.get('HTTP_X_FORWARDED_HOST', 'none')}"
    )


def _get_auth_context_summary(auth: Optional[WebSocketSessionAuth]) -> str:
    """Return the socket auth payload fields that identify the client context."""
    if not auth:
        return "socket_auth=none"
    return (
        f"socket_session_id={auth.get('sessionId') or 'none'}; "
        f"socket_client_type={auth.get('clientType') or 'none'}; "
        f"socket_thread_id={auth.get('threadId') or 'none'}; "
        f"socket_chat_profile={auth.get('chatProfile') or 'none'}"
    )


def _get_token_identity_hint(token: Optional[str]) -> str:
    """Return non-sensitive identity hints decoded from the JWT payload."""
    if not token:
        return "token_identifier=none; token_tenant=none; token_provider=none; token_roles=none"

    try:
        token_payload = pyjwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": False},
            algorithms=["HS256"],
        )
    except Exception:
        return "token_identifier=unreadable; token_tenant=unreadable; token_provider=unreadable; token_roles=unreadable"

    metadata = token_payload.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    roles_value = metadata.get("roles", [])
    roles = ",".join(str(role) for role in roles_value) if isinstance(roles_value, list) and roles_value else "none"
    identifier = token_payload.get("identifier") or "none"
    tenant_id = metadata.get("tenant_id") or "none"
    provider = metadata.get("provider") or "none"
    return (
        f"token_identifier={identifier}; "
        f"token_tenant={tenant_id}; "
        f"token_provider={provider}; "
        f"token_roles={roles}"
    )


def _format_auth_failure_message(reason: str) -> str:
    """Build the user-facing websocket authentication rejection reason."""
    return f"authentication failed: {reason}"


def _extract_exception_detail(exc: Exception) -> str:
    """Return a safe human-readable detail extracted from an auth exception."""
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, str) and detail.strip():
            return detail.strip()
        if isinstance(detail, dict):
            message = detail.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
    text = str(exc).strip()
    return text or exc.__class__.__name__


def _diagnose_auth_failure(
    environ: WSGIEnvironment,
    auth: Optional[WebSocketSessionAuth] = None,
    auth_exception: Optional[Exception] = None,
) -> str:
    """Explain why websocket authentication failed without exposing secrets."""
    auth_cookie_name = _get_expected_auth_cookie_name()
    cookie_names = _get_cookie_names(environ)
    token = _get_token(environ)
    request_source = _get_request_source_summary(environ)
    auth_context = _get_auth_context_summary(auth)
    token_identity = _get_token_identity_hint(token)

    if "HTTP_COOKIE" not in environ:
        return _format_auth_failure_message(
            f"missing Cookie header on websocket request to {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )

    if not token:
        available_cookies = ", ".join(cookie_names) if cookie_names else "none"
        chainlit_root_path = os.environ.get("CHAINLIT_ROOT_PATH", "/") or "/"
        cookie_samesite = os.environ.get("CHAINLIT_COOKIE_SAMESITE", "lax")
        chainlit_url = os.environ.get("CHAINLIT_URL", "not-configured")
        return _format_auth_failure_message(
            f"missing Chainlit auth cookie '{auth_cookie_name}' "
            f"(or chunked cookies '{auth_cookie_name}_0', '{auth_cookie_name}_1', ...); "
            f"browser only sent: {available_cookies}; "
            f"websocket request: {_get_request_location(environ)}; "
            f"configured CHAINLIT_URL={chainlit_url}, CHAINLIT_ROOT_PATH={chainlit_root_path}, "
            f"CHAINLIT_COOKIE_SAMESITE={cookie_samesite}; "
            f"{request_source}; {auth_context}; {token_identity}; "
            "likely causes: OAuth/login callback did not set the Chainlit cookie, "
            "cookie domain/path does not match this host/path, or the browser blocked the cookie due to SameSite/Secure policy"
        )

    try:
        decode_jwt(token)
    except AssertionError:
        return _format_auth_failure_message(
            f"CHAINLIT_AUTH_SECRET is not configured; {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )
    except pyjwt.ExpiredSignatureError:
        return _format_auth_failure_message(
            f"access token expired; {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )
    except pyjwt.InvalidSignatureError:
        return _format_auth_failure_message(
            f"invalid token signature; {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )
    except pyjwt.DecodeError as exc:
        if "Not enough segments" in str(exc):
            return _format_auth_failure_message(
                f"malformed JWT token; {_get_request_location(environ)}; "
                f"{request_source}; {auth_context}; {token_identity}"
            )
        return _format_auth_failure_message(
            f"token decode error ({exc}); {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )
    except pyjwt.InvalidTokenError as exc:
        return _format_auth_failure_message(
            f"invalid token ({exc}); {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )
    except Exception as exc:
        return _format_auth_failure_message(
            f"unexpected token validation error ({exc}); {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )

    if auth_exception is not None:
        return _format_auth_failure_message(
            f"{_extract_exception_detail(auth_exception)}; {_get_request_location(environ)}; "
            f"{request_source}; {auth_context}; {token_identity}"
        )

    return _format_auth_failure_message(
        f"token is valid but no authenticated user could be resolved; {_get_request_location(environ)}; "
        f"{request_source}; {auth_context}; {token_identity}"
    )


async def _authenticate_connection(
    environ: WSGIEnvironment,
) -> Union[Tuple[Union[User, PersistedUser], str], Tuple[None, None]]:
    if token := _get_token(environ):
        user = await get_current_user(token=token)
        if user:
            return user, token

    return None, None


@sio.on("connect")  # pyright: ignore [reportOptionalCall]
async def connect(sid: str, environ: WSGIEnvironment, auth: WebSocketSessionAuth):
    user: User | PersistedUser | None = None
    token: str | None = None
    thread_id = auth.get("threadId", None)
    auth_exception: Exception | None = None

    if require_login():
        try:
            user, token = await _authenticate_connection(environ)
        except Exception as e:
            auth_exception = e
            logger.exception("Exception authenticating connection: %s", e)

        if not user:
            failure_reason = _diagnose_auth_failure(environ, auth, auth_exception)
            logger.error(
                "Authentication failed in websocket connect. reason=%s path=%s host=%s origin=%s referer=%s user_agent=%s remote_addr=%s x_forwarded_for=%s token_identity=%s cookies=%s",
                failure_reason,
                environ.get("PATH_INFO"),
                environ.get("HTTP_HOST"),
                environ.get("HTTP_ORIGIN"),
                environ.get("HTTP_REFERER"),
                environ.get("HTTP_USER_AGENT"),
                environ.get("REMOTE_ADDR"),
                environ.get("HTTP_X_FORWARDED_FOR"),
                _get_token_identity_hint(token or _get_token(environ)),
                ",".join(_get_cookie_names(environ)) or "none",
            )
            raise ConnectionRefusedError(failure_reason)

        if thread_id:
            if data_layer := get_data_layer():
                thread = await data_layer.get_thread(thread_id)
                if thread and not (thread["userIdentifier"] == user.identifier):
                    logger.error("Authorization for the thread failed.")
                    raise ConnectionRefusedError("authorization failed")

    # Session scoped function to emit to the client
    def emit_fn(event, data):
        return sio.emit(event, data, to=sid)

    # Session scoped function to emit to the client and wait for a response
    def emit_call_fn(event: Literal["ask", "call_fn"], data, timeout):
        return sio.call(event, data, timeout=timeout, to=sid)

    session_id = auth["sessionId"]
    if restore_existing_session(
        sid, session_id, emit_fn, emit_call_fn, environ, user=user
    ):
        return True

    user_env_string = auth.get("userEnv", None)
    user_env = load_user_env(user_env_string)

    client_type = auth["clientType"]
    url_encoded_chat_profile = auth.get("chatProfile", None)
    chat_profile = (
        unquote(url_encoded_chat_profile) if url_encoded_chat_profile else None
    )

    WebsocketSession(
        id=session_id,
        socket_id=sid,
        emit=emit_fn,
        emit_call=emit_call_fn,
        client_type=client_type,
        user_env=user_env,
        user=user,
        token=token,
        chat_profile=chat_profile,
        thread_id=thread_id,
        environ=environ,
    )

    return True


@sio.on("connection_successful")  # pyright: ignore [reportOptionalCall]
async def connection_successful(sid):
    context = init_ws_context(sid)

    await context.emitter.task_end()
    await context.emitter.clear("clear_ask")
    await context.emitter.clear("clear_call_fn")

    if context.session.restored and not context.session.has_first_interaction:
        if config.code.on_chat_start and not context.session.chat_started:
            context.session.chat_started = True
            task = asyncio.create_task(config.code.on_chat_start())
            context.session.current_task = task
        return

    if context.session.thread_id_to_resume and config.code.on_chat_resume:
        thread = await resume_thread(context.session)
        if thread:
            context.session.has_first_interaction = True
            await context.emitter.emit(
                "first_interaction",
                {"interaction": "resume", "thread_id": thread.get("id")},
            )
            await config.code.on_chat_resume(thread)

            for step in thread.get("steps", []):
                if "message" in step["type"]:
                    chat_context.add(Message.from_dict(step))

            await context.emitter.resume_thread(thread)
            return
        else:
            await context.emitter.send_resume_thread_error("Thread not found.")

    if config.code.on_chat_start and not context.session.chat_started:
        context.session.chat_started = True
        task = asyncio.create_task(config.code.on_chat_start())
        context.session.current_task = task


@sio.on("clear_session")  # pyright: ignore [reportOptionalCall]
async def clean_session(sid):
    session = WebsocketSession.get(sid)
    if session:
        session.to_clear = True


@sio.on("disconnect")  # pyright: ignore [reportOptionalCall]
async def disconnect(sid):
    session = WebsocketSession.get(sid)

    if not session:
        return

    init_ws_context(session)

    if config.code.on_chat_end:
        await config.code.on_chat_end()

    if session.thread_id and session.has_first_interaction:
        await persist_user_session(session.thread_id, session.to_persistable())

    async def clear(_sid):
        if session := WebsocketSession.get(_sid):
            # Clean up the user session
            if session.id in user_sessions:
                user_sessions.pop(session.id)
            # Clean up the session
            await session.delete()

    if session.to_clear:
        await clear(sid)
    else:

        async def clear_on_timeout(_sid):
            await asyncio.sleep(config.project.session_timeout)
            await clear(_sid)

        asyncio.ensure_future(clear_on_timeout(sid))


@sio.on("stop")  # pyright: ignore [reportOptionalCall]
async def stop(sid):
    if session := WebsocketSession.get(sid):
        init_ws_context(session)
        await Message(content="Task manually stopped.").send()

        if session.current_task:
            session.current_task.cancel()

        if config.code.on_stop:
            await config.code.on_stop()


async def process_message(session: WebsocketSession, payload: MessagePayload):
    """Process a message from the user."""
    try:
        context = init_ws_context(session)
        await context.emitter.task_start()
        message = await context.emitter.process_message(payload)

        if config.code.on_message:
            await asyncio.sleep(0.001)
            await config.code.on_message(message)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.exception(e)
        await ErrorMessage(
            author="Error", content=str(e) or e.__class__.__name__
        ).send()
    finally:
        await context.emitter.task_end()


@sio.on("edit_message")  # pyright: ignore [reportOptionalCall]
async def edit_message(sid, payload: MessagePayload):
    """Handle a message sent by the User."""
    session = WebsocketSession.require(sid)
    context = init_ws_context(session)

    messages = chat_context.get()

    orig_message = None

    for message in messages:
        if orig_message:
            await message.remove()

        if message.id == payload["message"]["id"]:
            message.content = payload["message"]["output"]
            await message.update()
            orig_message = message

    await context.emitter.task_start()

    if config.code.on_message:
        try:
            await config.code.on_message(orig_message)
        except asyncio.CancelledError:
            pass
        finally:
            await context.emitter.task_end()


@sio.on("message_favorite")  # pyright: ignore [reportOptionalCall]
async def message_favorite(sid, payload: MessagePayload):
    """Handle a message favorite toggle."""
    session = WebsocketSession.require(sid)
    context = init_ws_context(session)
    data_layer = get_data_layer()

    if not config.features.favorites or not session.user:
        return

    payload_message = payload["message"]
    payload_metadata = payload_message.get("metadata") or {}
    favorite = bool(payload_metadata.get("favorite", False))

    step_dict = None

    if favorite:
        for message in chat_context.get():
            if message.id == payload_message["id"]:
                message.metadata = message.metadata or {}
                message.metadata["favorite"] = favorite
                step_dict = message.to_dict()
                break
    elif data_layer:
        favorites = await data_layer.get_favorite_steps(session.user.id)
        for fav in favorites:
            if fav["id"] == payload_message["id"]:
                step_dict = fav
                break

    if step_dict is None:
        logger.error("Could not find step to update favorite status.")
        return

    created_at = step_dict.get("createdAt")
    if created_at and not created_at.endswith("Z"):
        step_dict["createdAt"] = f"{created_at}Z"

    if data_layer:
        step_dict = await data_layer.set_step_favorite(step_dict, favorite)

    await context.emitter.update_step(step_dict)
    await fetch_favorites(sid)


@sio.on("fetch_favorites")  # pyright: ignore [reportOptionalCall]
async def fetch_favorites(sid):
    session = WebsocketSession.require(sid)
    context = init_ws_context(session)
    if session.user and config.features.favorites:
        if data_layer := get_data_layer():
            favorites = await data_layer.get_favorite_steps(session.user.id)
            await context.emitter.set_favorites(favorites)


@sio.on("client_message")  # pyright: ignore [reportOptionalCall]
async def message(sid, payload: MessagePayload):
    """Handle a message sent by the User."""
    session = WebsocketSession.require(sid)

    task = asyncio.create_task(process_message(session, payload))
    session.current_task = task


@sio.on("window_message")  # pyright: ignore [reportOptionalCall]
async def window_message(sid, data):
    """Handle a message send by the host window."""
    session = WebsocketSession.require(sid)
    init_ws_context(session)

    if config.code.on_window_message:
        try:
            await config.code.on_window_message(data)
        except asyncio.CancelledError:
            pass


@sio.on("audio_start")  # pyright: ignore [reportOptionalCall]
async def audio_start(sid):
    """Handle audio init."""
    session = WebsocketSession.require(sid)

    context = init_ws_context(session)
    config: ChainlitConfig = session.get_config()  # type: ignore

    if config.features.audio and config.features.audio.enabled:
        connected = bool(await config.code.on_audio_start())
        connection_state = "on" if connected else "off"
        await context.emitter.update_audio_connection(connection_state)


@sio.on("audio_chunk")
async def audio_chunk(sid, payload: InputAudioChunkPayload):
    """Handle an audio chunk sent by the user."""
    session = WebsocketSession.require(sid)

    init_ws_context(session)

    config: ChainlitConfig = session.get_config()

    if (
        config.features.audio
        and config.features.audio.enabled
        and config.code.on_audio_chunk
    ):
        asyncio.create_task(config.code.on_audio_chunk(InputAudioChunk(**payload)))


@sio.on("audio_end")
async def audio_end(sid):
    """Handle the end of the audio stream."""
    session = WebsocketSession.require(sid)

    try:
        context = init_ws_context(session)
        await context.emitter.task_start()

        if not session.has_first_interaction:
            session.has_first_interaction = True
            asyncio.create_task(context.emitter.init_thread("audio"))

        config: ChainlitConfig = session.get_config()  # type: ignore

        if config.features.audio and config.features.audio.enabled:
            await config.code.on_audio_end()

    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.exception(e)
        await ErrorMessage(
            author="Error", content=str(e) or e.__class__.__name__
        ).send()
    finally:
        await context.emitter.task_end()


@sio.on("chat_settings_change")
async def change_settings(sid, settings: Dict[str, Any]):
    """Handle change settings submit from the UI."""
    context = init_ws_context(sid)

    for key, value in settings.items():
        context.session.chat_settings[key] = value

    if config.code.on_settings_update:
        await config.code.on_settings_update(settings)


@sio.on("chat_settings_edit")
async def edit_settings(sid, settings: Dict[str, Any]):
    """Handle change settings edit from the UI (on the fly)."""
    init_ws_context(sid)

    if config.code.on_settings_edit:
        await config.code.on_settings_edit(settings)
