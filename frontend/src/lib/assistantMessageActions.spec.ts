import { describe, expect, it } from 'vitest';

import type { IStep } from '@chainlit/react-client';

import {
  isAssistantInteractionMessage,
  isContentAssistantMessage
} from './assistantMessageActions';

const baseMessage = (overrides: Partial<IStep> = {}): IStep => ({
  id: 'msg-1',
  name: 'Assistant',
  type: 'assistant_message',
  output: 'Hello',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides
});

describe('assistantMessageActions', () => {
  it('treats regular assistant output as content', () => {
    expect(isContentAssistantMessage(baseMessage())).toBe(true);
  });

  it('excludes ask/action prompts', () => {
    expect(
      isAssistantInteractionMessage(baseMessage({ waitForAnswer: true }))
    ).toBe(true);
    expect(
      isContentAssistantMessage(
        baseMessage({ metadata: { assistantInteraction: true } })
      )
    ).toBe(false);
  });

  it('excludes resolved action bubbles, which no longer wait for an answer', () => {
    expect(
      isContentAssistantMessage(
        baseMessage({
          output: '**Selected:** Continue',
          waitForAnswer: false,
          metadata: { assistantInteraction: true }
        })
      )
    ).toBe(false);
  });

  it('excludes action timeout follow-ups', () => {
    expect(
      isContentAssistantMessage(
        baseMessage({ metadata: { timeoutGeneratedInteraction: true } })
      )
    ).toBe(false);
  });
});
