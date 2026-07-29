import { cn, hasMessage } from '@/lib/utils';
import { MutableRefObject } from 'react';

import { FileSpec, useChatMessages } from '@chainlit/react-client';

import WaterMark from '@/components/WaterMark';

import MessageComposer from './MessageComposer';

interface Props {
  fileSpec: FileSpec;
  onFileUpload: (payload: File[]) => void;
  onFileUploadError: (error: string) => void;
  autoScrollRef: MutableRefObject<boolean>;
  showIfEmptyThread?: boolean;
}

export default function ChatFooter({ showIfEmptyThread, ...props }: Props) {
  const { messages } = useChatMessages();
  if (!hasMessage(messages) && !showIfEmptyThread) return null;

  return (
    <div className={cn('relative flex flex-col items-center gap-2 w-full')}>
      {/* Soft fade into the chat so the composer does not sit flush against messages. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-full h-[15px] bg-gradient-to-t from-background to-transparent"
      />
      <MessageComposer {...props} />
      <WaterMark />
    </div>
  );
}
