import type { IStep } from '@chainlit/react-client';

/**
 * Ask/action prompts and action timeout follow-ups. These never own the
 * message icon group (copy / docx / feedback).
 */
export const isAssistantInteractionMessage = (message: IStep): boolean => {
  if (message.waitForAnswer) {
    return true;
  }
  const metadata = message.metadata || {};
  return Boolean(
    metadata.assistantInteraction || metadata.timeoutGeneratedInteraction
  );
};

/** Finished content assistant bubbles that may own the icon group. */
export const isContentAssistantMessage = (message: IStep): boolean =>
  message.type === 'assistant_message' && !isAssistantInteractionMessage(message);
