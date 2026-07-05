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


async def test_send_step_does_not_initialize_thread_on_first_assistant_turn(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "assistant-first-step",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Hello from the assistant first turn",
    }
    mock_websocket_session.has_first_interaction = False
    mock_websocket_session.register_logical_assistant_message.return_value = 1
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    await emitter.send_step(step_dict)
    await asyncio.sleep(0)

    assert mock_websocket_session.has_first_interaction is False
    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]
    mock_websocket_session.emit.assert_called_once_with("new_message", step_dict)


async def test_send_step_ignores_timeout_followup_messages_for_thread_threshold(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "assistant-timeout-step",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "The response timeout expired, so the system selected the default option",
        "metadata": {"countsTowardThreadPersistenceThreshold": False},
    }
    mock_websocket_session.has_first_interaction = False
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    await emitter.send_step(step_dict)
    await asyncio.sleep(0)

    mock_websocket_session.register_logical_assistant_message.assert_not_called()
    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]
    mock_websocket_session.emit.assert_called_once_with("new_message", step_dict)


async def test_send_step_initializes_thread_on_second_assistant_turn(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    first_step: StepDict = {
        "id": "assistant-first-step",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Hello from the assistant first turn",
    }
    second_step: StepDict = {
        "id": "assistant-second-step",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Hello from the assistant second turn",
    }
    mock_websocket_session.has_first_interaction = False
    mock_websocket_session.register_logical_assistant_message.side_effect = [1, 2]
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    await emitter.send_step(first_step)
    await emitter.send_step(second_step)
    await asyncio.sleep(0)

    emitter.ensure_thread_persistence.assert_awaited_once_with(  # type: ignore[attr-defined]
        "Hello from the assistant second turn"
    )


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


async def test_update_step_does_not_count_as_new_assistant_message(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "assistant-update-step",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Updated assistant content",
    }

    await emitter.update_step(step_dict)

    mock_websocket_session.register_logical_assistant_message.assert_not_called()
    mock_websocket_session.emit.assert_called_once_with("update_message", step_dict)


async def test_stream_start_does_not_initialize_thread_on_first_assistant_turn(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    step_dict: StepDict = {
        "id": "assistant-first-stream",
        "type": "assistant_message",
        "name": "Assistant",
        "output": "Streaming hello",
    }
    mock_websocket_session.has_first_interaction = False
    mock_websocket_session.register_logical_assistant_message.return_value = 1
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    await emitter.stream_start(step_dict)
    await asyncio.sleep(0)

    assert mock_websocket_session.has_first_interaction is False
    emitter.ensure_thread_persistence.assert_not_awaited()  # type: ignore[attr-defined]
    mock_websocket_session.emit.assert_called_once_with("stream_start", step_dict)


async def test_stream_start_initializes_thread_on_second_assistant_turn(
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
    mock_websocket_session.register_logical_assistant_message.side_effect = [1, 2]
    emitter.ensure_thread_persistence = AsyncMock()  # type: ignore[method-assign]

    await emitter.stream_start(first_step)
    await emitter.stream_start(second_step)
    await asyncio.sleep(0)

    emitter.ensure_thread_persistence.assert_awaited_once_with("Streaming again")  # type: ignore[attr-defined]
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


async def test_send_token_does_not_count_as_new_message(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    await emitter.send_token("assistant-stream", "token-chunk", is_sequence=False, is_input=False)

    mock_websocket_session.register_logical_assistant_message.assert_not_called()
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
    )
    mock_websocket_session.flush_method_queue.assert_awaited_once()


async def test_flush_thread_queues_persists_staged_metadata_before_queue_flush(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    call_order = []
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
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


async def test_ensure_thread_persistence_without_data_layer_keeps_ui_interaction_only(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.has_first_interaction = False
    mock_websocket_session.thread_persistence_ready = False

    with patch("chainlit.emitter.get_data_layer", return_value=None):
        await emitter.ensure_thread_persistence("hello")

    assert mock_websocket_session.has_first_interaction is True
    assert mock_websocket_session.thread_persistence_ready is False
    mock_websocket_session.emit.assert_called_once_with(
        "first_interaction",
        {"interaction": "hello", "thread_id": "thread-1"},
    )


async def test_set_thread_title_persists_name_and_emits_runtime_update(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
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


async def test_set_thread_title_skips_runtime_update_without_data_layer(
    emitter: ChainlitEmitter, mock_websocket_session: MagicMock
) -> None:
    mock_websocket_session.thread_id = "thread-1"
    mock_websocket_session.chat_profile = None
    mock_websocket_session.user = None

    with patch("chainlit.emitter.get_data_layer", return_value=None):
        result = await emitter.set_thread_title("My first request")

    assert result is False
    mock_websocket_session.emit.assert_not_called()
