import { MessageContext } from 'contexts/MessageContext';
import React, { memo, useContext } from 'react';

import {
  type IAction,
  type IMessageElement,
  type IStep,
  useConfig
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
  parentMessage?: IStep; // Parent step for child messages grouping
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
  ({ messages, elements, actions, indent, isRunning, scorableRun, parentMessage }: Props) => {
    const messageContext = useContext(MessageContext);
    const layoutMaxWidth = useLayoutMaxWidth();
    const { config } = useConfig();
    
    return (
      <>
        {messages.map((m, index) => {
          // Get previous message for grouping logic
          // For child steps/messages at same level (index > 0), use previous sibling
          // For first child at level 0 with indent=0 (child assistant messages), use parent
          const isFirstInArray = index === 0;
          const previousMessage = !isFirstInArray ? messages[index - 1] : null;
          
          // Smart author detection: use metadata.avatarName if available, otherwise use message.name
          // The backend (bot_name) is the source of truth for the author name
          const getMessageAuthor = (message: IStep) => {
            // Priority 1: If metadata.avatarName is set, use it (new messages with explicit metadata)
            if (message.metadata?.avatarName) {
              return message.metadata.avatarName;
            }
            
            // Priority 2: For legacy persisted messages, detect if it's assistant by type
            // This ensures old conversations group correctly even without metadata.avatarName
            const isAssistantType = message.type && (
              message.type.includes('llm') ||
              message.type.includes('tool') ||
              message.type.includes('assistant') ||
              message.type.includes('retrieval') ||
              message.type.includes('rerank')
            );
            
            // If it's an assistant type, normalize to a common name
            // We'll use the first non-technical name we find in the messages array
            if (isAssistantType) {
              // Try to find a bot name from sibling messages with metadata.avatarName
              const botNameFromSiblings = messages.find(m => m.metadata?.avatarName)?.metadata?.avatarName;
              if (botNameFromSiblings) {
                return botNameFromSiblings;
              }
              // Fallback: use the message name if it looks like a bot name (not a technical name)
              if (message.name && !message.name.includes('herramienta') && !message.name.includes('razonamiento')) {
                return message.name;
              }
              // Last fallback: use config bot name or 'Assistant'
              return config?.ui?.name || 'Assistant';
            }
            
            // Priority 3: Use message.name as-is (for user messages, etc.)
            return message.name || 'Assistant';
          };
          
          // Group consecutive messages/steps from same author
          // Child steps (nested, indent > 0) should NOT group with parent
          // Only child assistant messages at root level (indent = 0) can group with parent
          const currentAuthor = getMessageAuthor(m);
          const previousAuthor = previousMessage ? getMessageAuthor(previousMessage) : null;
          
          // For first child assistant message (indent=0), check parent for grouping
          const parentAuthor = isFirstInArray && parentMessage && indent === 0 ? getMessageAuthor(parentMessage) : null;
          const effectivePreviousAuthor = previousAuthor || parentAuthor;
          
          const shouldGroup = Boolean(
            (previousMessage || (parentMessage && indent === 0)) &&
            !CL_RUN_NAMES.includes(m.name) &&
            (!previousMessage || !CL_RUN_NAMES.includes(previousMessage.name)) &&
            (!parentMessage || !CL_RUN_NAMES.includes(parentMessage.name)) &&
            currentAuthor === effectivePreviousAuthor
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
                messages={messages}
                index={index}
              />
            );
          }
        })}
      </>
    );
  }
);

export { Messages };
