import { cn } from '@/lib/utils';
import { MessageContext } from 'contexts/MessageContext';
import { Star } from 'lucide-react';
import { memo, useContext, useState } from 'react';
import { useSetRecoilState } from 'recoil';

import {
  IMessageElement,
  IStep,
  messagesState,
  useChatInteract,
  useConfig
} from '@chainlit/react-client';

import AutoResizeTextarea from '@/components/AutoResizeTextarea';
import { Pencil } from '@/components/icons/Pencil';
import { Button } from '@/components/ui/button';
import { Translator } from 'components/i18n';

import { InlinedElements } from './Content/InlinedElements';

/** Canvas/file prompts: hide the full payload in the thread and show a compact chip. */
const FILE_COMMAND_USER_PREFIX = 'FileCommand:';

function isFileCommandUserOutput(output: unknown): boolean {
  return (
    typeof output === 'string' && output.trimStart().startsWith(FILE_COMMAND_USER_PREFIX)
  );
}

interface Props {
  message: IStep;
  elements: IMessageElement[];
}

const UserMessage = memo(function UserMessage({
  message,
  elements,
  children
}: React.PropsWithChildren<Props>) {
  const { askUser, loading, editable } = useContext(MessageContext);
  const { editMessage, toggleMessageFavorite } = useChatInteract();
  const { config } = useConfig();
  const setMessages = useSetRecoilState(messagesState);
  const disabled = loading || !!askUser;
  const isFavorite = message.metadata?.favorite === true;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const inlineElements = elements.filter(
    (el) => el.forId === message.id && el.display === 'inline'
  );
  const favoritesEnabled = !!config?.features?.favorites;
  const showFileCommandChip = isFileCommandUserOutput(message.output) && !isEditing;

  const handleEdit = () => {
    if (editValue) {
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === message.id);
        if (index === -1) {
          return prev;
        }
        const slice = prev.slice(0, index + 1);
        slice[index].steps = [];
        return slice;
      });
      setIsEditing(false);
      editMessage({ ...message, output: editValue });
    }
  };

  return (
    <div className="flex flex-col w-full gap-1">
      <InlinedElements elements={inlineElements} className="items-end" />

      <div className="flex flex-row items-center gap-1 w-full group">
        {!isEditing && editable && (
          <Button
            variant="ghost"
            size="icon"
            className="edit-message ml-auto invisible group-hover:visible"
            onClick={() => {
              setEditValue(message.output);
              setIsEditing(true);
            }}
            disabled={disabled}
          >
            <Pencil />
          </Button>
        )}
        {!isEditing && favoritesEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'favorite-message invisible group-hover:visible',
              isFavorite ? 'visible text-yellow-500' : 'text-muted-foreground',
              !editable && 'ml-auto'
            )}
            onClick={() => toggleMessageFavorite(message)}
            disabled={disabled}
          >
            <Star className={cn('h-4 w-4', isFavorite ? 'fill-current' : '')} />
          </Button>
        )}
        <div
          className={cn(
            'px-5 py-2.5 relative bg-accent dark:bg-card rounded-2xl border',
            inlineElements.length ? 'rounded-tr-lg' : '',
            isEditing ? 'w-full flex-grow' : 'max-w-[70%] flex-grow-0',
            editable ? '' : 'ml-auto',
            showFileCommandChip && 'px-3 py-2 bg-transparent dark:bg-transparent border-none'
          )}
          style={
            showFileCommandChip
              ? undefined
              : { borderColor: 'hsl(var(--accent-border))' }
          }
        >
          {isEditing ? (
            <div className="bg-accent flex flex-col">
              <AutoResizeTextarea
                id="edit-chat-input"
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="mt-1 bg-transparent placeholder:text-base placeholder:font-medium text-base"
                maxHeight={250}
              />
              <div className="flex justify-end gap-4">
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                  <Translator path="common.actions.cancel" />
                </Button>
                <Button
                  className="confirm-edit"
                  disabled={disabled}
                  onClick={handleEdit}
                >
                  <Translator path="common.actions.confirm" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {message.command ? (
                <div className="font-bold text-[#08f] command-span">
                  {message.command}
                </div>
              ) : null}
              {showFileCommandChip ? (
                <span
                  className={cn(
                    'inline-flex max-w-full items-center rounded-[4px] border border-solid px-2.5 py-1 text-sm font-medium',
                    'bg-[#e0f7fa] text-[#0d47a1] border-[#0d47a1]',
                    'dark:bg-[#0d47a1] dark:border-[#e0f7fa] dark:text-[#e0f7fa]'
                  )}
                >
                  <Translator path="chat.userMessage.fileCommandChip" />
                </span>
              ) : (
                children
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default UserMessage;
