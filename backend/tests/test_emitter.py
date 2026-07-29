import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from chainlit.element import ElementDict
from chainlit.emitter import ChainlitEmitter
from chainlit.step import StepDict
from chainlit.user import PersistedUser


@pytest.fixture
def emitter(mock_websocket_session):
    return ChainlitEmitter(mock_websocket_session)


async def test_send_element(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    element_dict: ElementDict = {
        "id": "test_element",
        "threadId": None,
        "type": "text",
        "chainlitKey": None,
        "url": None,
        "objectKey": None,
        "name": "Test Element",
        "display": "inline",
        "size": None,
        "language": None,
        "page": None,
        "props": None,
        "autoPlay": None,
        "playerConfig": None,
        "forId": None,
        "mime": None,
    }

    await emitter.send_element(element_dict)

    mock_websocket_session.emit.assert_called_once_with("element", element_dict)


async def test_send_step(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "test_step",
        "type": "user_message",
        "name": "Test Step",
        "output": "This is a test step",
    }

    await emitter.send_step(step_dict)

    mock_websocket_session.emit.assert_called_once_with("new_message", step_dict)


async def test_send_step_never_ensures_thread_persistence(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "assistant-first-step",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Hello from the assistant",
    }
    mock_websocket_session.has_first_interaction = False
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    await emitter.send_step(step_dict)
    await asyncio.sleep(0)

    assert mock_websocket_session.has_first_interaction is False
    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]
    mock_websocket_session.emit.assert_called_once_with("new_message", step_dict)


async def test_send_step_with_icon(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "test_step_with_icon",
        "type": "tool",
        "name": "Test Step with Icon",
        "output": "This is a test step with an icon",
        "metadata": {"icon": "search"},
    }

    await emitter.send_step(step_dict)

    mock_websocket_session.emit.assert_called_once_with("new_message", step_dict)


async def test_update_step(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "test_step",
        "type": "assistant_message",
        "name": "Updated Test Step",
        "output": "This is an updated test step",
    }

    await emitter.update_step(step_dict)

    mock_websocket_session.emit.assert_called_once_with("update_message", step_dict)


async def test_update_step_with_icon(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "test_step_with_icon",
        "type": "tool",
        "name": "Updated Test Step with Icon",
        "output": "This is an updated test step with an icon",
        "metadata": {"icon": "database"},
    }

    await emitter.update_step(step_dict)

    mock_websocket_session.emit.assert_called_once_with("update_message", step_dict)


async def test_delete_step(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "test_step",
        "type": "system_message",
        "name": "Deleted Test Step",
        "output": "This step will be deleted",
    }

    await emitter.delete_step(step_dict)

    mock_websocket_session.emit.assert_called_once_with("delete_message", step_dict)


async def test_send_timeout(emitter, mock_websocket_session):
    await emitter.send_timeout("ask_timeout")
    mock_websocket_session.emit.assert_called_once_with("ask_timeout", {})


async def test_clear(emitter, mock_websocket_session):
    await emitter.clear("clear_ask")
    mock_websocket_session.emit.assert_called_once_with("clear_ask", {})


async def test_send_token(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    await emitter.send_token("test_id", "test_token", is_sequence=True, is_input=False)
    mock_websocket_session.emit.assert_called_once_with(
        "stream_token",
        {"id": "test_id", "token": "test_token", "isSequence": True, "isInput": False},
    )


async def test_set_chat_settings(emitter, mock_websocket_session):
    settings = {"key": "value"}
    emitter.set_chat_settings(settings)
    assert emitter.session.chat_settings == settings


async def test_update_token_count(emitter, mock_websocket_session):
    count = 100
    await emitter.update_token_count(count)
    mock_websocket_session.emit.assert_called_once_with("token_usage", count)


async def test_task_start(emitter, mock_websocket_session):
    await emitter.task_start()
    mock_websocket_session.emit.assert_called_once_with("task_start", {})


async def test_task_end(emitter, mock_websocket_session):
    await emitter.task_end()
    mock_websocket_session.emit.assert_called_once_with("task_end", {})


async def test_stream_start(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "test_stream",
        "type": "run",
        "name": "Test Stream",
        "output": "This is a test stream",
    }
    await emitter.stream_start(step_dict)
    mock_websocket_session.emit.assert_called_once_with("stream_start", step_dict)


async def test_stream_start_never_ensures_thread_persistence(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    first_step: StepDict = {
        "id": "assistant-first-stream",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Streaming hello",
    }
    second_step: StepDict = {
        "id": "assistant-second-stream",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Streaming again",
    }
    mock_websocket_session.has_first_interaction = False
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    await emitter.stream_start(first_step)
    await emitter.stream_start(second_step)
    await asyncio.sleep(0)

    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]
    assert mock_websocket_session.emit.call_count == 2


async def test_stream_start_with_icon(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "test_stream_with_icon",
        "type": "tool",
        "name": "Test Stream with Icon",
        "output": "This is a test stream with an icon",
        "metadata": {"icon": "cpu"},
    }
    await emitter.stream_start(step_dict)
    mock_websocket_session.emit.assert_called_once_with("stream_start", step_dict)


async def test_send_token(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    await emitter.send_token("assistant-stream", "token-chunk", is_sequence=False, is_input=False)

    mock_websocket_session.emit.assert_called_once_with(
        "stream_token",
        {"id": "assistant-stream", "token": "token-chunk", "isSequence": False, "isInput": False},
    )


async def test_send_toast(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    message = "This is a test message"
    await emitter.send_toast(message)
    mock_websocket_session.emit.assert_called_once_with(
        "toast", {"message": message, "type": "info"}
    )


async def test_send_toast_with_type(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    message = "This is a test message"
    await emitter.send_toast(message, type="error")
    mock_websocket_session.emit.assert_called_once_with(
        "toast", {"message": message, "type": "error"}
    )


async def test_send_toast_invalid_type(emitter: ChainlitEmitter) -> None:
    message = "This is a test message"
    with pytest.raises(ValueError, match="Invalid toast type: invalid"):
        await emitter.send_toast(message, type="invalid")  # type: ignore[arg-type]


async def test_flush_thread_queues_creates_thread_without_auto_title(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
    mock_websocket_session.project_id = None
    mock_websocket_session.user = PersistedUser(
        id="user-1",
        createdAt="2024-01-01T00:00:00Z",
        identifier="user@example.com",
    )
    mock_websocket_session.flush_method_queue = AsyncMock()
    mock_websocket_session.consume_pending_thread_metadata_patches.return_value = {}
    mock_data_layer = AsyncMock()

    with patch("chainlit.emitter.get_data_layer", return_value=mock_data_layer):
        await emitter.flush_thread_queues()
        await asyncio.sleep(0)

    mock_data_layer.update_thread.assert_called_once_with(
        thread_id="thread-1",
        user_id="user-1",
        tags=None,
        project_id=None,
    )
    mock_websocket_session.flush_method_queue.assert_awaited_once()


async def test_flush_thread_queues_persists_staged_metadata_before_queue_flush(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    call_order = []
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
    mock_websocket_session.project_id = None
    mock_websocket_session.user = PersistedUser(
        id="user-1",
        createdAt="2024-01-01T00:00:00Z",
        identifier="user@example.com",
    )
    mock_websocket_session.consume_pending_thread_metadata_patches.return_value = {
        "prompt_language": "es"
    }

    async def _flush_queue():
        call_order.append("flush_queue")

    mock_websocket_session.flush_method_queue = AsyncMock(side_effect=_flush_queue)
    mock_data_layer = AsyncMock()

    async def _update_thread(**_kwargs):
        call_order.append("update_thread")

    async def _patch_thread_metadata(*_args, **_kwargs):
        call_order.append("patch_thread_metadata")

    mock_data_layer.update_thread.side_effect = _update_thread
    mock_data_layer.patch_thread_metadata.side_effect = _patch_thread_metadata

    with patch("chainlit.emitter.get_data_layer", return_value=mock_data_layer):
        await emitter.flush_thread_queues()
        await asyncio.sleep(0)

    assert call_order == [
        "update_thread",
        "patch_thread_metadata",
        "flush_queue",
    ]


async def test_ensure_thread_persistence_without_data_layer_raises(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.has_first_interaction = False
    mock_websocket_session.thread_persistence_ready = False

    with patch("chainlit.emitter.get_data_layer", return_value=None):
        with pytest.raises(RuntimeError, match="Thread persistence flush failed"):
            await emitter.ensure_thread_persistence("hello")

    assert mock_websocket_session.has_first_interaction is False
    assert mock_websocket_session.thread_persistence_ready is False
    mock_websocket_session.emit.assert_not_called()


async def test_ensure_thread_persistence_raises_when_already_in_progress(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_persistence_ready = False
    mock_websocket_session.thread_persistence_in_progress = True

    with pytest.raises(RuntimeError, match="Thread persistence already in progress"):
        await emitter.ensure_thread_persistence("hello")


async def test_set_thread_title_persists_name_and_emits_runtime_update(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
    mock_websocket_session.thread_persistence_ready = True
    mock_websocket_session.user = PersistedUser(
        id="user-1",
        createdAt="2024-01-01T00:00:00Z",
        identifier="user@example.com",
    )
    mock_data_layer = AsyncMock()

    with patch("chainlit.emitter.get_data_layer", return_value=mock_data_layer):
        result = await emitter.set_thread_title("  My first request  ")

    assert result is True
    mock_data_layer.update_thread.assert_called_once_with(
        thread_id="thread-1",
        name="My first request",
        user_id="user-1",
        tags=None,
    )
    mock_websocket_session.emit.assert_called_once_with(
        "thread_title_updated",
        {"thread_id": "thread-1", "name": "My first request"},
    )


async def test_set_thread_title_flushes_then_renames_when_not_ready(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
    mock_websocket_session.project_id = None
    mock_websocket_session.thread_persistence_ready = False
    mock_websocket_session.user = PersistedUser(
        id="user-1",
        createdAt="2024-01-01T00:00:00Z",
        identifier="user@example.com",
    )
    mock_websocket_session.flush_method_queue = AsyncMock()
    mock_websocket_session.consume_pending_thread_metadata_patches.return_value = {}
    mock_data_layer = AsyncMock()

    with patch("chainlit.emitter.get_data_layer", return_value=mock_data_layer):
        result = await emitter.set_thread_title("Manual title")

    assert result is True
    assert mock_data_layer.update_thread.await_count == 2
    first_call = mock_data_layer.update_thread.await_args_list[0].kwargs
    second_call = mock_data_layer.update_thread.await_args_list[1].kwargs
    assert first_call == {
        "thread_id": "thread-1",
        "user_id": "user-1",
        "tags": None,
        "project_id": None,
    }
    assert second_call == {
        "thread_id": "thread-1",
        "name": "Manual title",
        "user_id": "user-1",
        "tags": None,
    }
    assert mock_websocket_session.thread_persistence_ready is True


async def test_set_thread_title_raises_without_data_layer(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
    mock_websocket_session.user = None

    with patch("chainlit.emitter.get_data_layer", return_value=None):
        with pytest.raises(RuntimeError, match="No data layer is configured"):
            await emitter.set_thread_title("My first request")

    mock_websocket_session.emit.assert_not_called()


async def test_set_thread_title_raises_on_empty_title(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    with pytest.raises(ValueError, match="Thread title cannot be empty"):
        await emitter.set_thread_title("   ")


async def test_send_ask_user_ephemeral_element_skips_thread_persistence(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    """AskElement replies must not flush thread persistence."""
    from chainlit.types import AskElementSpec

    step_dict: StepDict = {
        "id": "ask-ephemeral",
        "parentId": "parent-1",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Motd",
    }
    spec = AskElementSpec(
        type="element",
        step_id="ask-ephemeral",
        timeout=60,
        element_id="el-1",
        ephemeral=True,
    )
    mock_websocket_session.files_spec = {}
    mock_websocket_session.emit_call = AsyncMock(
        return_value={"submitted": True, "dismissed": "continue"}
    )
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]
    emitter.task_end = AsyncMock()  # type: ignore[method-assign]
    emitter.task_start = AsyncMock()  # type: ignore[method-assign]
    emitter.clear = AsyncMock()  # type: ignore[method-assign]

    result = await emitter.send_ask_user(step_dict, spec)

    assert result == {"submitted": True, "dismissed": "continue"}
    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]


async def test_send_ask_user_durable_element_skips_thread_persistence(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    """Non-ephemeral AskElement replies also do not persist the thread."""
    from chainlit.types import AskElementSpec

    step_dict: StepDict = {
        "id": "ask-durable",
        "parentId": "parent-1",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Form",
    }
    spec = AskElementSpec(
        type="element",
        step_id="ask-durable",
        timeout=60,
        element_id="el-2",
        ephemeral=False,
    )
    mock_websocket_session.files_spec = {}
    mock_websocket_session.emit_call = AsyncMock(
        return_value={"submitted": True}
    )
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]
    emitter.task_end = AsyncMock()  # type: ignore[method-assign]
    emitter.task_start = AsyncMock()  # type: ignore[method-assign]
    emitter.clear = AsyncMock()  # type: ignore[method-assign]

    result = await emitter.send_ask_user(step_dict, spec)

    assert result == {"submitted": True}
    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]


async def test_send_ask_user_file_ensures_thread_persistence_when_not_ready(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    """AskFile replies flush the thread before durable element persistence."""
    from chainlit.types import AskFileSpec, FileDict

    step_dict: StepDict = {
        "id": "ask-file-1",
        "parentId": "parent-1",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Please upload a file",
    }
    spec = AskFileSpec(
        type="file",
        step_id="ask-file-1",
        timeout=60,
        accept=["text/plain"],
        max_files=1,
        max_size_mb=5,
    )
    uploaded: FileDict = {
        "id": "file-1",
        "name": "brief.txt",
        "path": "/tmp/brief.txt",
        "size": 12,
        "type": "text/plain",
    }
    mock_websocket_session.files_spec = {}
    mock_websocket_session.files = {"file-1": uploaded}
    mock_websocket_session.thread_persistence_ready = False
    mock_websocket_session.emit_call = AsyncMock(return_value=[{"id": "file-1"}])
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]
    emitter.task_end = AsyncMock()  # type: ignore[method-assign]
    emitter.task_start = AsyncMock()  # type: ignore[method-assign]
    emitter.clear = AsyncMock()  # type: ignore[method-assign]

    with patch("chainlit.emitter.Element") as mock_element_cls:
        mock_element = MagicMock()
        mock_element.send = AsyncMock()
        mock_element_cls.from_dict.return_value = mock_element
        mock_element_cls.infer_type_from_mime.return_value = "file"

        result = await emitter.send_ask_user(step_dict, spec)

    assert result == [uploaded]
    emitter.ensure_thread_persistence.assert_awaited_once_with("brief.txt")  # type: ignore[attr-defined]
    mock_element.send.assert_awaited_once_with(
        for_id="ask-file-1", await_data_layer=True
    )


async def test_send_ask_user_file_skips_ensure_when_already_ready(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    """AskFile must not re-flush when the thread row already exists."""
    from chainlit.types import AskFileSpec, FileDict

    step_dict: StepDict = {
        "id": "ask-file-2",
        "parentId": "parent-1",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Please upload a file",
    }
    spec = AskFileSpec(
        type="file",
        step_id="ask-file-2",
        timeout=60,
        accept=["text/plain"],
        max_files=1,
        max_size_mb=5,
    )
    uploaded: FileDict = {
        "id": "file-2",
        "name": "ready.txt",
        "path": "/tmp/ready.txt",
        "size": 4,
        "type": "text/plain",
    }
    mock_websocket_session.files_spec = {}
    mock_websocket_session.files = {"file-2": uploaded}
    mock_websocket_session.thread_persistence_ready = True
    mock_websocket_session.emit_call = AsyncMock(return_value=[{"id": "file-2"}])
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]
    emitter.task_end = AsyncMock()  # type: ignore[method-assign]
    emitter.task_start = AsyncMock()  # type: ignore[method-assign]
    emitter.clear = AsyncMock()  # type: ignore[method-assign]

    with patch("chainlit.emitter.Element") as mock_element_cls:
        mock_element = MagicMock()
        mock_element.send = AsyncMock()
        mock_element_cls.from_dict.return_value = mock_element
        mock_element_cls.infer_type_from_mime.return_value = "file"

        result = await emitter.send_ask_user(step_dict, spec)

    assert result == [uploaded]
    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]
    mock_element.send.assert_awaited_once_with(
        for_id="ask-file-2", await_data_layer=True
    )


async def test_process_message_ensures_thread_persistence_when_not_ready(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    """Composer user messages flush thread persistence when the session is not ready."""
    import uuid

    message_id = str(uuid.uuid4())
    step_dict: StepDict = {
        "id": message_id,
        "type": "user_message",
        "name": "User",
        "output": "hello from composer",
        "createdAt": "2024-01-01T00:00:00Z",
    }
    mock_websocket_session.thread_persistence_ready = False
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    fake_message = MagicMock()
    fake_message.id = message_id
    fake_message.content = "hello from composer"
    fake_message._create = AsyncMock()

    with (
        patch("chainlit.emitter.Message.from_dict", return_value=fake_message),
        patch("chainlit.emitter.chat_context.add"),
    ):
        result = await emitter.process_message(
            {"message": step_dict, "fileReferences": None}
        )

    assert result is fake_message
    emitter.ensure_thread_persistence.assert_awaited_once_with(  # type: ignore[attr-defined]
        "hello from composer"
    )


async def test_process_message_skips_ensure_when_already_ready(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    import uuid

    message_id = str(uuid.uuid4())
    step_dict: StepDict = {
        "id": message_id,
        "type": "user_message",
        "name": "User",
        "output": "hello again",
        "createdAt": "2024-01-01T00:00:00Z",
    }
    mock_websocket_session.thread_persistence_ready = True
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    fake_message = MagicMock()
    fake_message.id = message_id
    fake_message.content = "hello again"
    fake_message._create = AsyncMock()

    with (
        patch("chainlit.emitter.Message.from_dict", return_value=fake_message),
        patch("chainlit.emitter.chat_context.add"),
    ):
        await emitter.process_message({"message": step_dict, "fileReferences": None})

    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]
