import {
  IAction,
  type IStep,
  useChatMessages,
  useConfig
} from '@chainlit/react-client';

import CopyButton from '@/components/CopyButton';
import { isAssistantInteractionMessage } from '@/lib/assistantMessageActions';

import MessageActions from './Actions';
import { DebugButton } from './DebugButton';
import DocxExportButton from './DocxExportButton';
import { FeedbackButtons } from './FeedbackButtons';

interface Props {
  message: IStep;
  actions: IAction[];
  /** Turn run: owning the row means full group (copy/docx/feedback). */
  run?: IStep;
  contentRef?: React.RefObject<HTMLDivElement>;
}

const MessageButtons = ({ message, actions, run, contentRef }: Props) => {
  const { config } = useConfig();
  const { firstInteraction } = useChatMessages();

  const isUser = message.type === 'user_message';
  const isInteraction = isAssistantInteractionMessage(message);
  const hasContent = !!message.output;
  // Full group on content only. Ask/action bubbles never get it.
  const showGroup = !!run && hasContent && !isUser && !isInteraction;

  const messageActions = actions.filter((a) => a.forId === message.id);

  const showDebugButton =
    !!config?.debugUrl && !!message.threadId && !!firstInteraction && !!run;

  const show = showGroup || showDebugButton || messageActions?.length;

  if (!show || message.streaming) {
    return null;
  }

  return (
    <div className="-ml-1.5 flex items-center flex-wrap">
      {showGroup ? (
        <div className="message-action-row flex items-center flex-wrap">
          <CopyButton content={message.output} contentRef={contentRef} />
          <DocxExportButton contentRef={contentRef} />
          <FeedbackButtons message={run!} />
        </div>
      ) : null}
      {messageActions.length ? (
        <MessageActions actions={messageActions} />
      ) : null}
      {showDebugButton ? (
        <DebugButton debugUrl={config.debugUrl!} step={message} />
      ) : null}
    </div>
  );
};

export { MessageButtons };
