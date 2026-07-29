import datetime
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio

from chainlit import config
from chainlit.callbacks import data_layer
from chainlit.context import ChainlitContext, context_var
from chainlit.data.base import BaseDataLayer
from chainlit.session import HTTPSession, WebsocketSession
from chainlit.user import PersistedUser
from chainlit.user_session import UserSession


@pytest.fixture
def persisted_test_user():
    return PersistedUser(
        id="test_user_id",
        createdAt=datetime.datetime.now().isoformat(),
        identifier="test_user_identifier",
    )


@pytest.fixture
def mock_session_factory(persisted_test_user: PersistedUser) -> Callable[..., Mock]:
    def create_mock_session(**kwargs) -> Mock:
        mock = Mock(spec=WebsocketSession)
        mock.user = kwargs.get("user", persisted_test_user)
        mock.id = kwargs.get("id", "test_session_id")
        mock.user_env = kwargs.get("user_env", {"test_env": "value"})
        mock.chat_settings = kwargs.get("chat_settings", {})
        mock.chat_profile = kwargs.get("chat_profile", None)
        mock.environ = kwargs.get("environ", None)
        mock.client_type = kwargs.get("client_type", "webapp")
        mock.thread_id = kwargs.get("thread_id", "test_thread_id")
        mock.emit = AsyncMock()
        mock.has_first_interaction = kwargs.get("has_first_interaction", True)
        mock.thread_persistence_ready = kwargs.get("thread_persistence_ready", False)
        mock.thread_persistence_in_progress = kwargs.get(
            "thread_persistence_in_progress", False
        )
        mock.project_id = kwargs.get("project_id", None)
        mock.files = kwargs.get("files", {})
        mock.files_spec = kwargs.get("files_spec", {})
        mock.is_thread_persistence_ready = Mock(
            side_effect=lambda: mock.thread_persistence_ready
        )
        mock.begin_thread_persistence = Mock(
            side_effect=lambda: False
            if mock.thread_persistence_ready or mock.thread_persistence_in_progress
            else setattr(mock, "thread_persistence_in_progress", True) or True
        )
        mock.mark_thread_persistence_ready = Mock(
            side_effect=lambda: setattr(mock, "thread_persistence_ready", True)
            or setattr(mock, "thread_persistence_in_progress", False)
            or setattr(mock, "has_first_interaction", True)
        )
        mock.abort_thread_persistence = Mock(
            side_effect=lambda: setattr(mock, "thread_persistence_in_progress", False)
        )
        mock.consume_pending_thread_metadata_patches = Mock(return_value={})
        mock.reset_pre_persistence_state = Mock()
        mock.should_stage_thread_metadata = Mock(return_value=False)
        mock.stage_thread_metadata_patch = Mock()

        return mock

    return create_mock_session


@pytest.fixture
def mock_session(mock_session_factory) -> Mock:
    return mock_session_factory()


@asynccontextmanager
async def create_chainlit_context(mock_session):
    from chainlit.emitter import BaseChainlitEmitter

    # Create a mock emitter with all necessary methods
    mock_emitter = Mock(spec=BaseChainlitEmitter)
    mock_emitter.send_step = AsyncMock()
    mock_emitter.update_step = AsyncMock()
    mock_emitter.delete_step = AsyncMock()
    mock_emitter.stream_start = AsyncMock()
    mock_emitter.send_element = AsyncMock()
    mock_emitter.send_action = AsyncMock()
    mock_emitter.remove_action = AsyncMock()
    mock_emitter.emit = AsyncMock()
    mock_emitter.set_chat_settings = Mock()  # Sync method, not async

    context = ChainlitContext(mock_session, emitter=mock_emitter)
    token = context_var.set(context)
    try:
        yield context
    finally:
        context_var.reset(token)


@pytest_asyncio.fixture
async def mock_chainlit_context(persisted_test_user, mock_session):
    mock_session.user = persisted_test_user
    return create_chainlit_context(mock_session)


@pytest.fixture
def user_session():
    return UserSession()


@pytest.fixture
def mock_websocket_session():
    session = Mock(spec=WebsocketSession)
    session.emit = AsyncMock()
    session.has_first_interaction = False
    session.thread_persistence_ready = False
    session.thread_persistence_in_progress = False
    session.project_id = None
    session.is_thread_persistence_ready = Mock(
        side_effect=lambda: session.thread_persistence_ready
    )
    session.begin_thread_persistence = Mock(
        side_effect=lambda: False
        if session.thread_persistence_ready or session.thread_persistence_in_progress
        else setattr(session, "thread_persistence_in_progress", True) or True
    )
    session.mark_thread_persistence_ready = Mock(
        side_effect=lambda: setattr(session, "thread_persistence_ready", True)
        or setattr(session, "thread_persistence_in_progress", False)
        or setattr(session, "has_first_interaction", True)
    )
    session.abort_thread_persistence = Mock(
        side_effect=lambda: setattr(session, "thread_persistence_in_progress", False)
    )
    session.consume_pending_thread_metadata_patches = Mock(return_value={})
    session.reset_pre_persistence_state = Mock()
    session.should_stage_thread_metadata = Mock(return_value=False)
    session.stage_thread_metadata_patch = Mock()

    return session


@pytest.fixture
def mock_http_session():
    return Mock(spec=HTTPSession)


@pytest.fixture
def mock_data_layer(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    mock_data_layer = AsyncMock(spec=BaseDataLayer)

    return mock_data_layer


@pytest.fixture
def mock_get_data_layer(mock_data_layer: AsyncMock, test_config: config.ChainlitConfig):
    # Instantiate mock data layer
    mock_get_data_layer = Mock(return_value=mock_data_layer)

    # Configure it using @data_layer decorator
    return data_layer(mock_get_data_layer)


@pytest.fixture
def test_config(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("CHAINLIT_ROOT_PATH", str(tmp_path))

    test_config = config.load_config()

    monkeypatch.setattr("chainlit.callbacks.config", test_config)
    monkeypatch.setattr("chainlit.server.config", test_config)
    monkeypatch.setattr("chainlit.config.config", test_config)

    return test_config
