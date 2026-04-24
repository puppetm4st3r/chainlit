import { createContext, useContext } from 'react';

import type { IStep } from '@chainlit/react-client';

const MessageSiblingsContext = createContext<IStep[] | null>(null);

const useMessageSiblings = () => useContext(MessageSiblingsContext);

export { MessageSiblingsContext, useMessageSiblings };
