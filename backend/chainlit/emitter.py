import asyncio
import uuid
from typing import Any, Dict, List, Literal, Optional, Union, cast, get_args

from socketio.exceptions import TimeoutError

from chainlit.chat_context import chat_context
from chainlit.config import config
from chainlit.data import get_data_layer
from chainlit.element import Element, ElementDict
from chainlit.logger import logger
from chainlit.message import Message
from chainlit.mode import Mode
from chainlit.session import (
    BaseSession,
    WebsocketSession,
    resolve_effective_conversation_history_controls,
    resolve_effective_spontaneous_file_upload_enabled,
    validate_runtime_spontaneous_file_upload_config,
)
from chainlit.step import StepDict
from chainlit.types import (
    AskActionResponse,
    AskElementResponse,
    AskFileSpec,
    AskSpec,
    CommandDict,
    FileDict,
    FileReference,
    MessagePayload,
    OutputAudioChunk,
    ThreadDict,
    ToastType,
)
from chainlit.user import PersistedUser
from chainlit.utils import utc_now



class BaseChainlitEmitter:
    """
    Chainlit Emitter Stub class. This class is used for testing purposes.
    It stubs the ChainlitEmitter class and does nothing on function calls.
    """

    session: BaseSession
    enabled: bool = True

    def __init__(self, session: BaseSession) -> None:
        """Initialize with the user session."""
        self.session = session

    async def emit(self, event: str, data: Any):
        """Stub method to get the 'emit' property from the session."""
        pass

    async def emit_call(self):
        """Stub method to get the 'emit_call' property from the session."""
        pass

    async def resume_thread(self, thread_dict: ThreadDict):
        """Stub method to resume a thread."""
        pass

    async def send_resume_thread_error(self, error: str):
        """Stub method to send a resume thread error."""
        pass

    async def send_element(self, element_dict: ElementDict):
        """Stub method to send an element to the UI."""
        pass

    async def update_audio_connection(self, state: Literal["on", "off"]):
        """Audio connection signaling."""
        pass

    async def send_audio_chunk(self, chunk: OutputAudioChunk):
        """Stub method to send an audio chunk to the UI."""
        pass

    async def send_audio_interrupt(self):
        """Stub method to interrupt the current audio response."""
        pass

    async def send_step(self, step_dict: StepDict):
        """Stub method to send a message to the UI."""
        pass

    async def update_step(self, step_dict: StepDict):
        """Stub method to update a message in the UI."""
        pass

    async def delete_step(self, step_dict: StepDict):
        """Stub method to delete a message in the UI."""
        pass

    def send_timeout(self, event: Literal["ask_timeout", "call_fn_timeout"]):
        """Stub method to send a timeout to the UI."""
        pass

    def clear(self, event: Literal["clear_ask", "clear_call_fn"]):
        pass

    async def init_thread(self, interaction: str):
        pass

    async def set_thread_title(self, title: str) -> bool:
        """Stub method to persist and emit a thread title update."""
        return False

    async def process_message(self, payload: MessagePayload) -> Message:
        """Stub method to process user message."""
        return Message(content="")

    async def send_ask_user(
        self, step_dict: StepDict, spec: AskSpec, raise_on_timeout=False
    ) -> Optional[
        Union["StepDict", "AskActionResponse", "AskElementResponse", List["FileDict"]]
    ]:
        """Stub method to send a prompt to the UI and wait for a response."""
        pass

    async def send_call_fn(
        self, name: str, args: Dict[str, Any], timeout=300, raise_on_timeout=False
    ) -> Optional[Dict[str, Any]]:
        """Stub method to send a call function event to the copilot and wait for a response."""
        pass

    async def update_token_count(self, count: int):
        """Stub method to update the token count for the UI."""
        pass

    def set_spontaneous_file_upload(self, enabled: Optional[bool] = None):
        """Stub method to synchronize spontaneous file upload state in the UI."""
        pass

    def set_conversation_history_visibility(
        self,
        visible: Optional[bool] = None,
        *,
        show_new_thread: Optional[bool] = None,
        show_delete_threads: Optional[bool] = None,
    ):
        """Stub method to synchronize conversation-history visibility in the UI."""
        pass

    def set_new_chat_button_visibility(self, visible: Optional[bool] = None):
        """Backward-compatible stub for conversation-history visibility."""
        return self.set_conversation_history_visibility(visible)

    async def task_start(self):
        """Stub method to send a task start signal to the UI."""
        pass

    async def task_end(self):
        """Stub method to send a task end signal to the UI."""
        pass

    async def stream_start(self, step_dict: StepDict):
        """Stub method to send a stream start signal to the UI."""
        pass

    async def send_token(self, id: str, token: str, is_sequence=False, is_input=False):
        """Stub method to send a message token to the UI."""
        pass

    async def set_chat_settings(self, settings: dict):
        """Stub method to set chat settings."""
        pass

    async def update_chat_settings(self, settings: dict):
        """Stub method to update chat settings values."""
        pass

    async def set_commands(self, commands: List[CommandDict]):
        """Stub method to send the available commands to the UI."""
        pass

    async def set_modes(self, modes: List[Mode]):
        """Stub method to send the available modes to the UI."""
        pass

    async def set_input_restriction(
        self,
        mode: Literal["mix", "only_modes", "selection_only"],
        placeholder: Optional[str] = None,
    ):
        """Stub method to synchronize composer restriction state in the UI."""
        pass

    async def send_window_message(self, data: Any):
        """Stub method to send custom data to the host window."""
        pass

    async def send_toast(self, message: str, type: Optional[ToastType] = "info"):
        """Stub method to send a toast message to the UI."""
        pass

    async def set_chat_profile(self, profile_name: str):
        """Stub method to send a chat profile selection to the UI."""
        pass

    async def set_project(self, project_id: Optional[str]):
        """Stub method to send the active conversation project to the UI."""
        pass

    async def set_favorites(self, steps: List[StepDict]):
        """Stub method to send the favorite messages to the UI."""
        pass

class ChainlitEmitter(BaseChainlitEmitter):
    """
    Chainlit Emitter class. The Emitter is not directly exposed to the developer.
    Instead, the developer interacts with the Emitter through the methods and classes exposed in the __init__ file.
    """

    session: WebsocketSession

    def __init__(self, session: WebsocketSession) -> None:
        """Initialize with the user session."""
        self.session = session

    def _get_session_property(self, property_name: str, raise_error=True):
        """Helper method to get a property from the session."""
        if not hasattr(self, "session") or not hasattr(self.session, property_name):
            if raise_error:
                raise ValueError(f"Session does not have property '{property_name}'")
            else:
                return None
        return getattr(self.session, property_name)

    @property
    def emit(self):
        """Get the 'emit' property from the session."""

        return self._get_session_property("emit")

    @property
    def emit_call(self):
        """Get the 'emit_call' property from the session."""
        return self._get_session_property("emit_call")

    def resume_thread(self, thread_dict: ThreadDict):
        """Send a thread to the UI to resume it"""
        return self.emit("resume_thread", thread_dict)

    def send_resume_thread_error(self, error: str):
        """Send a thread resume error to the UI"""
        return self.emit("resume_thread_error", error)

    async def update_audio_connection(self, state: Literal["on", "off"]):
        """Audio connection signaling."""
        await self.emit("audio_connection", state)

    async def send_audio_chunk(self, chunk: OutputAudioChunk):
        """Send an audio chunk to the UI."""
        await self.emit("audio_chunk", chunk)

    async def send_audio_interrupt(self):
        """Method to interrupt the current audio response."""
        await self.emit("audio_interrupt", {})

    async def send_element(self, element_dict: ElementDict):
        """Stub method to send an element to the UI."""
        await self.emit("element", element_dict)

    def send_step(self, step_dict: StepDict):
        """Send a message to the UI."""
        return self.emit("new_message", step_dict)

    def update_step(self, step_dict: StepDict):
        """Update a message in the UI."""
        return self.emit("update_message", step_dict)

    def delete_step(self, step_dict: StepDict):
        """Delete a message in the UI."""
        return self.emit("delete_message", step_dict)

    def send_timeout(self, event: Literal["ask_timeout", "call_fn_timeout"]):
        return self.emit(event, {})

    def clear(self, event: Literal["clear_ask", "clear_call_fn"]):
        return self.emit(event, {})

    def _get_thread_user_id(self) -> Optional[str]:
        """Resolve the persisted user id for thread updates when available."""
        if isinstance(self.session.user, PersistedUser):
            return self.session.user.id
        return None

    def _get_thread_tags(self) -> Optional[List[str]]:
        """Resolve the thread tags that should be attached on persistence."""
        should_tag_thread = (
            self.session.chat_profile and config.features.auto_tag_thread
        )
        return [self.session.chat_profile] if should_tag_thread else None

    async def ensure_thread_persistence(self, interaction: str) -> None:
        """
        Persist the thread row once and flush staged steps/elements.

        Idempotent when already ready. Raises when another flush is in flight or
        when the flush does not leave the session in a ready state.
        """
        if self.session.is_thread_persistence_ready():
            return
        if not self.session.begin_thread_persistence():
            raise RuntimeError("Thread persistence already in progress")
        try:
            persisted = await self.init_thread(interaction)
        except Exception:
            self.session.abort_thread_persistence()
            raise
        if not persisted or not self.session.is_thread_persistence_ready():
            self.session.abort_thread_persistence()
            raise RuntimeError("Thread persistence flush failed")

    async def flush_thread_queues(self) -> bool:
        """Flush the thread row and staged metadata; return False without a data layer."""
        data_layer = get_data_layer()
        if not data_layer:
            return False
        try:
            await data_layer.update_thread(
                thread_id=self.session.thread_id,
                user_id=self._get_thread_user_id(),
                tags=self._get_thread_tags(),
                project_id=self.session.project_id,
            )
        except Exception as e:
            logger.error(f"Error updating thread: {e}")
            return False

        pending_metadata_patch = self.session.consume_pending_thread_metadata_patches()
        if pending_metadata_patch:
            patcher = getattr(data_layer, "patch_thread_metadata", None)
            try:
                if callable(patcher):
                    await patcher(self.session.thread_id, pending_metadata_patch)
                else:
                    await data_layer.update_thread(
                        thread_id=self.session.thread_id,
                        user_id=self._get_thread_user_id(),
                        metadata=pending_metadata_patch,
                        tags=self._get_thread_tags(),
                    )
            except Exception as e:
                logger.error(f"Error updating thread metadata: {e}")
                return False

        asyncio.create_task(self.session.flush_method_queue())
        self.session.mark_thread_persistence_ready()
        return True

    async def init_thread(self, interaction: str) -> bool:
        persisted = await self.flush_thread_queues()
        if not persisted:
            return False
        await self.emit(
            "first_interaction",
            {
                "interaction": interaction,
                "thread_id": self.session.thread_id,
            },
        )
        return True

    async def set_thread_title(self, title: str) -> bool:
        """
        Flush thread persistence when needed, then persist the visible thread title.

        This is the manual persistence entry point used by the thread-title workflow
        node. Empty titles and missing data layers raise instead of soft-failing.
        """
        normalized_title = str(title or "").strip()
        if not normalized_title:
            raise ValueError("Thread title cannot be empty")

        data_layer = get_data_layer()
        if not data_layer:
            raise RuntimeError("No data layer is configured for thread title updates")

        if not self.session.is_thread_persistence_ready():
            await self.ensure_thread_persistence(normalized_title)
        if not self.session.is_thread_persistence_ready():
            raise RuntimeError("Thread persistence flush failed")

        await data_layer.update_thread(
            thread_id=self.session.thread_id,
            name=normalized_title,
            user_id=self._get_thread_user_id(),
            tags=self._get_thread_tags(),
        )

        await self.emit(
            "thread_title_updated",
            {
                "thread_id": self.session.thread_id,
                "name": normalized_title,
            },
        )
        return True

    async def _send_uploaded_elements(
        self,
        *,
        files: List[FileDict],
        for_id: str,
        display: Literal["inline", "side", "page", "floating"] = "inline",
    ) -> List[Element]:
        """
        Persist upload-backed file elements before exposing them to application code.

        Durable element persistence requires a flushed thread row: ``create_element``
        is staged by ``@queue_until_user_message`` until the session is ready. AskFile
        replies and composer uploads therefore flush here when needed (idempotent when
        ``process_message`` / ``set_thread_title`` already flushed).
        """
        if files and not self.session.is_thread_persistence_ready():
            interaction = str(files[0].get("name") or "").strip() or "file_upload"
            await self.ensure_thread_persistence(interaction)

        elements = [
            Element.from_dict(
                {
                    "id": file["id"],
                    "name": file["name"],
                    "path": str(file["path"]),
                    "chainlitKey": file["id"],
                    "display": display,
                    "type": Element.infer_type_from_mime(file["type"]),
                    "mime": file["type"],
                }
            )
            for file in files
        ]
        for element in elements:
            await element.send(for_id=for_id, await_data_layer=True)
        return elements

    async def process_message(self, payload: MessagePayload):
        step_dict = payload["message"]
        file_refs = payload.get("fileReferences")
        # UUID generated by the frontend should use v4
        assert uuid.UUID(step_dict["id"]).version == 4

        message = Message.from_dict(step_dict)
        # Overwrite the created_at timestamp with the current time
        message.created_at = utc_now()
        chat_context.add(message)

        await message._create()

        if not self.session.is_thread_persistence_ready():
            await self.ensure_thread_persistence(message.content)

        if file_refs:
            files = [
                self.session.files[file["id"]]
                for file in file_refs
                if file["id"] in self.session.files
            ]
            message.elements = await self._send_uploaded_elements(
                files=files,
                for_id=message.id,
            )

        return message

    async def send_ask_user(
        self, step_dict: StepDict, spec: AskSpec, raise_on_timeout=False
    ):
        """Send a prompt to the UI and wait for a response."""
        parent_id = str(step_dict["parentId"])
        try:
            if spec.type == "file":
                self.session.files_spec[parent_id] = cast(AskFileSpec, spec)

            # End the task temporarily so that the User can answer the prompt
            # (Stop/loading off while AskFile / actions / forms are open).
            await self.task_end()

            # Send the prompt to the UI and wait for the user response.
            user_res = await self.emit_call(
                "ask", {"msg": step_dict, "spec": spec.to_dict()}, spec.timeout
            )  # type: Optional[Union["StepDict", "AskActionResponse", "AskElementResponse", List["FileReference"]]]

            final_res: Optional[
                Union[StepDict, AskActionResponse, AskElementResponse, List[FileDict]]
            ] = None

            if user_res:
                if spec.type == "text":
                    message_dict_res = cast(StepDict, user_res)
                    # Text asks persist through process_message (user-message rule).
                    await self.process_message(
                        {"message": message_dict_res, "fileReferences": None}
                    )
                    final_res = message_dict_res
                elif spec.type == "file":
                    file_refs = cast(List[FileReference], user_res)
                    files = [
                        self.session.files[file["id"]]
                        for file in file_refs
                        if file["id"] in self.session.files
                    ]
                    final_res = files
                    await self._send_uploaded_elements(files=files, for_id=step_dict["id"])
                elif spec.type == "action":
                    final_res = cast(AskActionResponse, user_res)
                elif spec.type == "element":
                    final_res = cast(AskElementResponse, user_res)

            await self.clear("clear_ask")
            return final_res
        except TimeoutError as e:
            await self.send_timeout("ask_timeout")

            if raise_on_timeout:
                raise e
        finally:
            if parent_id in self.session.files_spec:
                del self.session.files_spec[parent_id]
            await self.task_start()

    async def send_call_fn(
        self, name: str, args: Dict[str, Any], timeout=300, raise_on_timeout=False
    ) -> Optional[Dict[str, Any]]:
        """Stub method to send a call function event to the copilot and wait for a response."""
        try:
            call_fn_res = await self.emit_call(
                "call_fn", {"name": name, "args": args}, timeout
            )  # type: Dict

            await self.clear("clear_call_fn")
            return call_fn_res
        except TimeoutError as e:
            await self.send_timeout("call_fn_timeout")

            if raise_on_timeout:
                raise e
            return None

    def update_token_count(self, count: int):
        """Update the token count for the UI."""

        return self.emit("token_usage", count)

    def task_start(self):
        """
        Send a task start signal to the UI.
        """
        return self.emit("task_start", {})

    def task_end(self):
        """Send a task end signal to the UI."""
        return self.emit("task_end", {})

    def stream_start(self, step_dict: StepDict):
        """Send a stream start signal to the UI."""
        return self.emit(
            "stream_start",
            step_dict,
        )

    def send_token(self, id: str, token: str, is_sequence=False, is_input=False):
        """Send a message token to the UI."""
        return self.emit(
            "stream_token",
            {"id": id, "token": token, "isSequence": is_sequence, "isInput": is_input},
        )

    def set_chat_settings(self, settings: Dict[str, Any]):
        self.session.chat_settings = settings

    async def update_chat_settings(self, settings: Dict[str, Any]):
        for key, value in settings.items():
            if isinstance(value, dict) and "value" in value:
                self.session.chat_settings[key] = value["value"]
            else:
                self.session.chat_settings[key] = value
        await self.emit("chat_settings_values", settings)

    def set_commands(self, commands: List[CommandDict]):
        """Send the available commands to the UI."""
        return self.emit(
            "set_commands",
            commands,
        )

    def set_modes(self, modes: List[Mode]):
        """Send the available modes to the UI."""
        return self.emit(
            "set_modes",
            [mode.to_dict() for mode in modes],
        )

    def set_input_restriction(
        self,
        mode: Literal["mix", "only_modes", "selection_only"],
        placeholder: Optional[str] = None,
    ):
        """Synchronize composer restriction state in the UI."""
        payload: Dict[str, Any] = {"mode": mode}
        if isinstance(placeholder, str) and placeholder.strip():
            payload["placeholder"] = placeholder.strip()
        return self.emit("set_input_restriction", payload)

    def set_spontaneous_file_upload(self, enabled: Optional[bool] = None):
        """Synchronize spontaneous file upload availability in the UI."""
        if enabled is True:
            validate_runtime_spontaneous_file_upload_config()

        self.session.spontaneous_file_upload_enabled_override = enabled
        return self.emit(
            "set_spontaneous_file_upload",
            resolve_effective_spontaneous_file_upload_enabled(self.session),
        )

    def set_conversation_history_visibility(
        self,
        visible: Optional[bool] = None,
        *,
        show_new_thread: Optional[bool] = None,
        show_delete_threads: Optional[bool] = None,
    ):
        """Synchronize conversation-history visibility and action controls in the UI."""
        self.session.conversation_history_visible_override = visible
        self.session.new_chat_button_visible_override = visible
        self.session.conversation_history_show_new_thread_override = show_new_thread
        self.session.conversation_history_show_delete_threads_override = (
            show_delete_threads
        )
        return self.emit(
            "set_conversation_history_visibility",
            resolve_effective_conversation_history_controls(self.session),
        )

    def set_new_chat_button_visibility(self, visible: Optional[bool] = None):
        """Backward-compatible alias for conversation-history visibility in the UI."""
        return self.set_conversation_history_visibility(visible)

    def set_favorites(self, steps: List[StepDict]):
        """Send the favorite messages to the UI."""
        return self.emit(
            "set_favorites",
            steps,
        )

    def send_window_message(self, data: Any):
        """Send custom data to the host window."""
        return self.emit("window_message", data)

    async def send_toast(self, message: str, type: Optional[ToastType] = "info"):
        """Send a toast message to the UI."""
        # check that the type is valid using ToastType
        if type not in get_args(ToastType):
            raise ValueError(f"Invalid toast type: {type}")
        return await self.emit("toast", {"message": message, "type": type})

    async def set_chat_profile(self, profile_name: str):
        """Send a chat profile selection to the UI."""
        await self.emit("set_chat_profile", profile_name)

    async def set_project(self, project_id: Optional[str]):
        """
        Send the active conversation project to the UI.

        ``None`` means the global bag (no project). A string is the normalized project id/name.
        """
        await self.emit("set_project", project_id)
