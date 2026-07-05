import { MessageContext } from '@/contexts/MessageContext';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { toast } from 'sonner';

import {
  ChainlitContext,
  currentThreadIdState,
  IFeedback,
  IMessageElement,
  IStep,
  messagesState,
  sessionIdState,
  sideViewState,
  updateMessageById,
  useChatData,
  useChatInteract,
  useChatMessages,
  useConfig
} from '@chainlit/react-client';

import { Messages } from '@/components/chat/Messages';
import {
  getCanvasShellCloseDetail,
  isCanvasShellElement,
  logCanvasCloseDiag
} from '@/lib/canvas';
import { buildSideViewElementsSignature } from '@/lib/sideView';
import { dismissedSideViewSignatureState } from '@/state/project';
import { useTranslation } from 'components/i18n/Translator';

interface Props {
  navigate?: (to: string) => void;
}

const keepSingleCanvasShellElement = (
  sideElements: IMessageElement[]
): IMessageElement[] => {
  const latestCanvasElement = [...sideElements]
    .reverse()
    .find(isCanvasShellElement);

  if (!latestCanvasElement) {
    return sideElements;
  }

  return sideElements.filter(
    (element) => !isCanvasShellElement(element) || element === latestCanvasElement
  );
};

const MessagesContainer = ({ navigate }: Props) => {
  const apiClient = useContext(ChainlitContext);
  const { config } = useConfig();
  const { elements, askUser, loading, actions } = useChatData();
  const { messages } = useChatMessages();
  const { uploadFile: _uploadFile } = useChatInteract();
  const setMessages = useSetRecoilState(messagesState);
  const setSideView = useSetRecoilState(sideViewState);
  const currentSideView = useRecoilValue(sideViewState);
  const currentThreadId = useRecoilValue(currentThreadIdState);
  const dismissedSideViewSignature = useRecoilValue(
    dismissedSideViewSignatureState
  );
  const setDismissedSideViewSignature = useSetRecoilState(
    dismissedSideViewSignatureState
  );
  const sessionId = useRecoilValue(sessionIdState);

  const { t } = useTranslation();

  const uploadFile = useCallback(
    (file: File, onProgress: (progress: number) => void, parentId?: string) => {
      return _uploadFile(file, onProgress, parentId);
    },
    [_uploadFile]
  );

  const onFeedbackUpdated = useCallback(
    async (message: IStep, onSuccess: () => void, feedback: IFeedback) => {
      toast.promise(apiClient.setFeedback(feedback, sessionId), {
        loading: t('chat.messages.feedback.status.updating'),
        success: (res) => {
          setMessages((prev) =>
            updateMessageById(prev, message.id, {
              ...message,
              feedback: {
                ...feedback,
                id: res.feedbackId
              }
            })
          );
          onSuccess();
          return t('chat.messages.feedback.status.updated');
        },
        error: (err) => {
          return <span>{err.message}</span>;
        }
      });
    },
    []
  );

  const onFeedbackDeleted = useCallback(
    async (message: IStep, onSuccess: () => void, feedbackId: string) => {
      toast.promise(apiClient.deleteFeedback(feedbackId), {
        loading: t('chat.messages.feedback.status.updating'),
        success: () => {
          setMessages((prev) =>
            updateMessageById(prev, message.id, {
              ...message,
              feedback: undefined
            })
          );
          onSuccess();
          return t('chat.messages.feedback.status.updated');
        },
        error: (err) => {
          return <span>{err.message}</span>;
        }
      });
    },
    []
  );

  const knownSideElementsRef = useRef<Map<string, IMessageElement>>(new Map());
  const knownSideOrderRef = useRef<string[]>([]);
  const previousThreadIdRef = useRef<string | undefined>(currentThreadId);

  useEffect(() => {
    if (previousThreadIdRef.current === currentThreadId) {
      return;
    }

    previousThreadIdRef.current = currentThreadId;
    knownSideElementsRef.current = new Map();
    knownSideOrderRef.current = [];
    setDismissedSideViewSignature(undefined);
  }, [currentThreadId, setDismissedSideViewSignature]);

  useEffect(() => {
    const sideElements = keepSingleCanvasShellElement(
      elements.filter((e) => e.display === 'side')
    );
    const nextSignature = buildSideViewElementsSignature(sideElements);
    const canvasDetail = getCanvasShellCloseDetail(sideElements);

    if (sideElements.length === 0) {
      knownSideElementsRef.current = new Map();
      knownSideOrderRef.current = [];
      if (dismissedSideViewSignature) {
        logCanvasCloseDiag('messages_container:side_elements_cleared', {
          dismissedSignature: dismissedSideViewSignature
        });
      }
      if (dismissedSideViewSignature) {
        setDismissedSideViewSignature(undefined);
      }
      setSideView((currentSideView) =>
        currentSideView?.key ? currentSideView : undefined
      );
      return;
    }

    const prevMap = knownSideElementsRef.current;
    const prevOrder = knownSideOrderRef.current;
    const currentIds = sideElements.map((e) => e.id);

    const hasChanged =
      currentIds.length !== prevOrder.length ||
      currentIds.some((id, i) => prevOrder[i] !== id) ||
      sideElements.some((e) => prevMap.get(e.id) !== e);

    if (hasChanged) {
      if (canvasDetail) {
        logCanvasCloseDiag('messages_container:side_elements_changed', {
          signature: nextSignature,
          dismissedSignature: dismissedSideViewSignature,
          canvas: canvasDetail,
          elementIds: currentIds
        });
      }
      const newMap = new Map<string, IMessageElement>();
      sideElements.forEach((e) => newMap.set(e.id, e));
      knownSideElementsRef.current = newMap;
      knownSideOrderRef.current = currentIds;
      if (
        dismissedSideViewSignature &&
        dismissedSideViewSignature === nextSignature
      ) {
        if (canvasDetail) {
          logCanvasCloseDiag('messages_container:reopen_suppressed_by_dismissed_signature', {
            signature: nextSignature,
            canvas: canvasDetail
          });
        }
        return;
      }
      if (dismissedSideViewSignature) {
        setDismissedSideViewSignature(undefined);
      }
      if (currentSideView?.key) {
        if (canvasDetail) {
          logCanvasCloseDiag(
            'messages_container:skip_override_keyed_side_view',
            {
              activeKey: currentSideView.key,
              signature: nextSignature,
              canvas: canvasDetail,
              elementIds: currentIds
            }
          );
        }
        return;
      }
      if (canvasDetail) {
        logCanvasCloseDiag('messages_container:set_side_view_from_elements', {
          signature: nextSignature,
          canvas: canvasDetail,
          elementIds: currentIds
        });
      }
      setSideView({
        title: sideElements[sideElements.length - 1].name,
        elements: sideElements
      });
    }
  }, [
    currentSideView,
    dismissedSideViewSignature,
    elements,
    setDismissedSideViewSignature,
    setSideView
  ]);

  const onElementRefClick = useCallback(
    (element: IMessageElement) => {
      if (
        element.display === 'side' ||
        (element.display === 'page' && !navigate)
      ) {
        setDismissedSideViewSignature(undefined);
        setSideView({ title: element.name, elements: [element] });
        return;
      }

      let path = `/element/${element.id}`;

      if (element.threadId) {
        path += `?thread=${element.threadId}`;
      }

      return navigate?.(element.display === 'page' ? path : '#');
    },
    [navigate, setDismissedSideViewSignature, setSideView]
  );

  const onError = useCallback((error: string) => toast.error(error), [toast]);

  const enableFeedback = !!config?.dataPersistence;

  // Memoize the context object since it's created on each render.
  // This prevents unnecessary re-renders of children components when no props have changed.
  const memoizedContext = useMemo(() => {
    return {
      uploadFile,
      askUser,
      allowHtml: config?.features?.unsafe_allow_html,
      latex: config?.features?.latex,
      renderUserMarkdown: config?.features?.user_message_markdown,
      editable: !!config?.features.edit_message,
      loading,
      showFeedbackButtons: enableFeedback,
      uiName: config?.ui?.name || '',
      cot: config?.ui?.cot || 'hidden',
      onElementRefClick,
      onError,
      onFeedbackUpdated,
      onFeedbackDeleted
    };
  }, [
    askUser,
    enableFeedback,
    loading,
    config?.ui?.name,
    config?.ui?.cot,
    config?.features?.unsafe_allow_html,
    config?.features?.user_message_markdown,
    onElementRefClick,
    onError,
    onFeedbackUpdated
  ]);

  return (
    <MessageContext.Provider value={memoizedContext}>
      <Messages
        indent={0}
        isRunning={loading}
        messages={messages}
        elements={elements}
        actions={actions}
      />
    </MessageContext.Provider>
  );
};

export default MessagesContainer;
