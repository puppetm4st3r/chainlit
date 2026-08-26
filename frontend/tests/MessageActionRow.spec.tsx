import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageContext } from '@/contexts/MessageContext';
import { Messages } from '@/components/chat/Messages';

vi.mock('@chainlit/react-client', () => ({
  useConfig: () => ({ config: { ui: { name: 'Bot', cot: 'full' } } }),
  useChatMessages: () => ({ firstInteraction: 'hello' })
}));

vi.mock('@/components/CopyButton', () => ({
  default: () => <div data-testid="copy-button" />
}));

vi.mock(
  '@/components/chat/Messages/Message/Buttons/DocxExportButton',
  () => ({ default: () => <div data-testid="docx-button" /> })
);

vi.mock('@/components/chat/Messages/Message/Buttons/FeedbackButtons', () => ({
  FeedbackButtons: () => <div data-testid="feedback-buttons" />
}));

vi.mock('@/components/chat/Messages/Message/Content', () => ({
  MessageContent: () => <div />
}));

vi.mock('@/components/chat/Messages/Message/Step', () => ({
  default: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/chat/Messages/Message/UserMessage', () => ({
  default: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/chat/Messages/Message/Avatar', () => ({
  MessageAvatar: () => <div />
}));

vi.mock('@/components/chat/Messages/Message/AskFileButton', () => ({
  AskFileButton: () => null
}));

vi.mock('@/components/chat/Messages/Message/AskActionButtons', () => ({
  AskActionButtons: () => null
}));

vi.mock('@/components/chat/Messages/Message/Buttons/Actions', () => ({
  default: () => <div data-testid="message-actions" />
}));

const streamedAssistant = {
  id: 'assistant-streamed',
  name: 'Bot',
  type: 'assistant_message' as const,
  threadId: 'thread-1',
  output: 'Respuesta del agente',
  createdAt: '2026-01-01T00:00:02.000Z',
  metadata: { avatarName: 'Bot' }
};

// Chainlit rewrites an action bubble on resolve/timeout: it gets content and
// drops waitForAnswer, so only the metadata tag keeps it out of the icon row.
const timedOutAction = {
  id: 'ask-prompt',
  name: 'Bot',
  type: 'assistant_message' as const,
  threadId: 'thread-1',
  output: 'Timed out',
  createdAt: '2026-01-01T00:00:03.000Z',
  waitForAnswer: false,
  metadata: { assistantInteraction: true, avatarName: 'Bot' }
};

const llmStep = {
  id: 'llm-step',
  name: 'razonamiento',
  type: 'llm' as const,
  threadId: 'thread-1',
  output: '',
  createdAt: '2026-01-01T00:00:01.000Z',
  steps: [streamedAssistant]
};

const runStep = {
  id: 'run-step',
  name: 'on_message',
  type: 'run' as const,
  threadId: 'thread-1',
  output: '',
  createdAt: '2026-01-01T00:00:00.500Z',
  steps: [llmStep, timedOutAction]
};

const userMessage = {
  id: 'user-message',
  name: 'User',
  type: 'user_message' as const,
  threadId: 'thread-1',
  output: 'Hola',
  createdAt: '2026-01-01T00:00:00.000Z',
  steps: [runStep]
};

const renderMessages = (loading: boolean) =>
  render(
    <MessageContext.Provider value={{ cot: 'full', loading } as any}>
      <Messages
        indent={0}
        isRunning={loading}
        messages={[userMessage] as any}
        elements={[]}
        actions={[]}
      />
    </MessageContext.Provider>
  );

describe('assistant message action row', () => {
  it('renders the full icon group once, on the streamed message and not on the action', () => {
    renderMessages(true);

    expect(screen.getAllByTestId('copy-button')).toHaveLength(1);
    expect(screen.getAllByTestId('docx-button')).toHaveLength(1);
    expect(screen.getAllByTestId('feedback-buttons')).toHaveLength(1);
    expect(screen.queryByTestId('tts-button')).toBeNull();
  });

  it('keeps the group on the streamed message once the turn is idle', () => {
    renderMessages(false);

    expect(screen.getAllByTestId('copy-button')).toHaveLength(1);
    expect(screen.getAllByTestId('feedback-buttons')).toHaveLength(1);
  });

  it('still renders the action buttons attached to an ask message', () => {
    render(
      <MessageContext.Provider value={{ cot: 'full', loading: true } as any}>
        <Messages
          indent={0}
          isRunning
          messages={[userMessage] as any}
          elements={[]}
          actions={[{ id: 'a1', forId: timedOutAction.id, name: 'continue' }] as any}
        />
      </MessageContext.Provider>
    );

    expect(screen.getAllByTestId('message-actions')).toHaveLength(1);
  });

  it('renders the group for workflows driven by on_chat_start', () => {
    render(
      <MessageContext.Provider value={{ cot: 'full', loading: true } as any}>
        <Messages
          indent={0}
          isRunning
          messages={[{ ...runStep, name: 'on_chat_start' }] as any}
          elements={[]}
          actions={[]}
        />
      </MessageContext.Provider>
    );

    expect(screen.getAllByTestId('copy-button')).toHaveLength(1);
    expect(screen.getAllByTestId('feedback-buttons')).toHaveLength(1);
  });
});
