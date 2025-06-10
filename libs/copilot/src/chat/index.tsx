import { useEffect, useRef } from 'react';

import { useChatInteract, useChatSession } from '@chainlit/react-client';

import ChatBody from './body';

interface ChatWrapperProps {
  isOpen: boolean;
}

export default function ChatWrapper({ isOpen }: ChatWrapperProps) {
  const { connect, session } = useChatSession();
  const { sendMessage } = useChatInteract();
  const hasConnected = useRef(false);

  useEffect(() => {
    // Only connect when widget is open and we haven't connected yet
    if (isOpen && !session?.socket?.connected && !hasConnected.current) {
      hasConnected.current = true;
      // Use requestAnimationFrame to ensure the widget is fully rendered
      requestAnimationFrame(() => {
        connect({
          // @ts-expect-error window typing
          transports: window.transports,
          userEnv: {}
        });
      });
    }
  }, [isOpen, connect, session?.socket?.connected]);

  useEffect(() => {
    // @ts-expect-error is not a valid prop
    window.sendChainlitMessage = sendMessage;
  }, [sendMessage]);

  return <ChatBody />;
}
