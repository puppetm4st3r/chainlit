import { describe, expect, it } from 'vitest';

import {
  ASSISTANT_TURN_COMPLETED_WINDOW_MESSAGE_TYPE,
  HUMAN_INTERACTION_WINDOW_MESSAGE_TYPE,
  buildAssistantTurnCompletedWindowMessage,
  buildHumanInteractionWindowMessage
} from '../src/lib/humanInteractionNotificationProtocol';

describe('human interaction notification protocol', () => {
  it('builds the human interaction window message', () => {
    const message = buildHumanInteractionWindowMessage({
      title: 'Assistant',
      body: 'The assistant has completed the task and is waiting for your review.',
      icon: 'https://example.com/avatar.png',
      ask: {
        type: 'action',
        stepId: 'step-1'
      }
    });

    expect(message).toEqual({
      source: 'chainlit',
      version: 1,
      type: HUMAN_INTERACTION_WINDOW_MESSAGE_TYPE,
      payload: {
        title: 'Assistant',
        body: 'The assistant has completed the task and is waiting for your review.',
        icon: 'https://example.com/avatar.png',
        ask: {
          type: 'action',
          stepId: 'step-1'
        }
      }
    });
  });

  it('builds the assistant turn completed window message', () => {
    const message = buildAssistantTurnCompletedWindowMessage({
      title: 'Assistant',
      body: 'The assistant has completed the task and is waiting for your review.',
      icon: 'https://example.com/avatar.png',
      turn: {
        messageId: 'message-1'
      }
    });

    expect(message).toEqual({
      source: 'chainlit',
      version: 1,
      type: ASSISTANT_TURN_COMPLETED_WINDOW_MESSAGE_TYPE,
      payload: {
        title: 'Assistant',
        body: 'The assistant has completed the task and is waiting for your review.',
        icon: 'https://example.com/avatar.png',
        turn: {
          messageId: 'message-1'
        }
      }
    });
  });
});
