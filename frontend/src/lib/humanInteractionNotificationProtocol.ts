export const HUMAN_INTERACTION_WINDOW_MESSAGE_TYPE =
  'chainlit.human_interaction_required';
export const ASSISTANT_TURN_COMPLETED_WINDOW_MESSAGE_TYPE =
  'chainlit.assistant_turn_completed';

export interface HumanInteractionWindowMessagePayload {
  title: string;
  body: string;
  icon?: string;
  ask: {
    type: 'text' | 'file' | 'action' | 'element';
    stepId: string;
  };
}

export interface AssistantTurnCompletedWindowMessagePayload {
  title: string;
  body: string;
  icon?: string;
  turn: {
    messageId: string;
  };
}

export interface HumanInteractionWindowMessage {
  source: 'chainlit';
  version: 1;
  type: typeof HUMAN_INTERACTION_WINDOW_MESSAGE_TYPE;
  payload: HumanInteractionWindowMessagePayload;
}

export interface AssistantTurnCompletedWindowMessage {
  source: 'chainlit';
  version: 1;
  type: typeof ASSISTANT_TURN_COMPLETED_WINDOW_MESSAGE_TYPE;
  payload: AssistantTurnCompletedWindowMessagePayload;
}

export function buildHumanInteractionWindowMessage(
  payload: HumanInteractionWindowMessagePayload
): HumanInteractionWindowMessage {
  return {
    source: 'chainlit',
    version: 1,
    type: HUMAN_INTERACTION_WINDOW_MESSAGE_TYPE,
    payload
  };
}

export function buildAssistantTurnCompletedWindowMessage(
  payload: AssistantTurnCompletedWindowMessagePayload
): AssistantTurnCompletedWindowMessage {
  return {
    source: 'chainlit',
    version: 1,
    type: ASSISTANT_TURN_COMPLETED_WINDOW_MESSAGE_TYPE,
    payload
  };
}
