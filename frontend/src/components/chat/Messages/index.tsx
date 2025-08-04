import { MessageContext } from 'contexts/MessageContext';
import React, { memo, useContext } from 'react';

import {
  type IAction,
  type IMessageElement,
  type IStep
} from '@chainlit/react-client';

import BlinkingCursor from '@/components/BlinkingCursor';
import { useLayoutMaxWidth } from 'hooks/useLayoutMaxWidth';

import { Message } from './Message';
import { MessageAvatar } from './Message/Avatar';

interface Props {
  messages: IStep[];
  elements: IMessageElement[];
  actions: IAction[];
  indent: number;
  isRunning?: boolean;
  scorableRun?: IStep;
}

const CL_RUN_NAMES = ['on_chat_start', 'on_message', 'on_audio_end'];

const hasActiveToolStep = (step: IStep): boolean => {
  return (
    step.steps?.some(
      (s) =>
        (s.type === 'tool' && s.start && !s.end && !s.isError) ||
        s.type.includes('message') ||
        hasActiveToolStep(s)
    ) || false
  );
};

const hasAssistantMessage = (step: IStep): boolean => {
  return (
    step.steps?.some(
      (s) => s.type === 'assistant_message' || hasAssistantMessage(s)
    ) || false
  );
};

const Messages = memo(
  ({ messages, elements, actions, indent, isRunning, scorableRun }: Props) => {
    const messageContext = useContext(MessageContext);
    const layoutMaxWidth = useLayoutMaxWidth();
    return (
      <>
        {messages.map((m, index) => {
          // Get previous message for grouping logic
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const getMessageAuthor = (message: IStep) => 
            message.metadata?.avatarName || message.name;
          
          // Determine if current or previous message is a step
          const isCurrentStep = !m.type.includes('message');
          const isPreviousStep = previousMessage && !previousMessage.type.includes('message');
          
          // Group consecutive messages from same author, but never group steps
          const shouldGroup = Boolean(
            previousMessage &&
            !isCurrentStep &&
            !isPreviousStep &&
            !CL_RUN_NAMES.includes(m.name) &&
            !CL_RUN_NAMES.includes(previousMessage.name) &&
            getMessageAuthor(m) === getMessageAuthor(previousMessage)
          );



          // Handle chainlit runs
          if (CL_RUN_NAMES.includes(m.name)) {
            const isRunning = !m.end && !m.isError && messageContext.loading;
            const isToolCallCoT = messageContext.cot === 'tool_call';
            const isHiddenCoT = messageContext.cot === 'hidden';

            const showToolCoTLoader = isToolCallCoT
              ? isRunning && !hasActiveToolStep(m)
              : false;

            const showHiddenCoTLoader = isHiddenCoT
              ? isRunning && !hasAssistantMessage(m)
              : false;

            // Show avatar for any COT that is running, regardless of steps
            const showCoTAvatar = isRunning && (isToolCallCoT || isHiddenCoT);
            // Ignore on_chat_start for scorable run
            const scorableRun =
              !isRunning && m.name !== 'on_chat_start' ? m : undefined;
            return (
              <React.Fragment key={m.id}>
                {m.steps?.length ? (
                  <Messages
                    messages={m.steps}
                    elements={elements}
                    actions={actions}
                    indent={indent}
                    isRunning={isRunning}
                    scorableRun={scorableRun}
                  />
                ) : null}
                {showCoTAvatar && m.name !== 'on_chat_start' && !m.steps?.length ? (
                  <div className="step py-2">
                    <div className="flex flex-col" style={{ maxWidth: layoutMaxWidth }}>
                      <div className="flex flex-grow pb-2">
                        <div className="ai-message flex gap-4 w-full">
                          <MessageAvatar
                            author={m.metadata?.avatarName || m.name}
                            isError={m.isError}
                            isStep={true}
                          />
                          <div className="flex flex-col flex-grow w-0">
                            {(showToolCoTLoader || showHiddenCoTLoader) ? (
                              <BlinkingCursor />
                            ) : (
                              <p className="flex items-center gap-1 font-medium loading-shimmer">
                                Usando {m.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </React.Fragment>
            );
          } else {
            // Score the current run
            const _scorableRun = m.type === 'run' ? m : scorableRun;
            // The message is scorable if it is the last assistant message of the run

            const isRunLastAssistantMessage =
              m ===
              _scorableRun?.steps?.findLast(
                (_m) => _m.type === 'assistant_message'
              );

            const isLastAssistantMessage =
              messages.findLast((_m) => _m.type === 'assistant_message') === m;

            const isScorable =
              isRunLastAssistantMessage || isLastAssistantMessage;

            return (
              <Message
                message={m}
                elements={elements}
                actions={actions}
                key={m.id}
                indent={indent}
                isRunning={isRunning}
                scorableRun={_scorableRun}
                isScorable={isScorable}
                shouldGroup={shouldGroup}
              />
            );
          }
        })}
      </>
    );
  }
);

export { Messages };
