import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import {
  ChainlitContext,
  type IStep,
  useChatData,
  useChatMessages,
  useChatSession,
  useConfig
} from '@chainlit/react-client';

import { useTranslation } from '@/components/i18n/Translator';
import {
  resolveAssistantAvatarUrl,
  resolveAssistantDisplayName
} from '@/lib/assistantAvatar';
import {
  buildAssistantTurnCompletedWindowMessage,
  buildHumanInteractionWindowMessage
} from '@/lib/humanInteractionNotificationProtocol';

const NOTIFICATION_PERMISSION_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;
const ASSISTANT_COMPLETION_TAG_PREFIX = 'assistant-turn:';
const ASSISTANT_LIKE_TYPES = new Set([
  'assistant_message',
  'tool',
  'llm',
  'retrieval',
  'rerank'
]);
function supportsBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function isPageVisible(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
}

function isEmbeddedInIframe(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

function findLastAssistantLikeMessageId(messages: IStep[]): string | undefined {
  let lastAssistantMessageId: string | undefined;

  const visitSteps = (steps: IStep[]) => {
    for (const step of steps) {
      if (ASSISTANT_LIKE_TYPES.has(step.type)) {
        lastAssistantMessageId = step.id;
      }

      if (step.steps?.length) {
        visitSteps(step.steps);
      }
    }
  };

  visitSteps(messages);
  return lastAssistantMessageId;
}

function logNotificationEvent(
  _message: string,
  _details?: Record<string, unknown>
) {}

export function useHumanInteractionNotification() {
  const apiClient = useContext(ChainlitContext);
  const { askUser, loading } = useChatData();
  const { messages } = useChatMessages();
  const { config } = useConfig();
  const { chatProfile } = useChatSession();
  const { t } = useTranslation();
  const previousAskKeyRef = useRef<string | undefined>(undefined);
  const previousLoadingRef = useRef<boolean>(loading);
  const taskStartAssistantMessageIdRef = useRef<string | undefined>(undefined);
  const sawAssistantOutputDuringTaskRef = useRef<boolean>(false);
  const activeNotificationRef = useRef<Notification | null>(null);

  const notificationTitle = useMemo(() => {
    return resolveAssistantDisplayName(config, chatProfile);
  }, [config, chatProfile]);

  const notificationBody = useMemo(() => {
    return t('chat.notifications.humanInteraction.body');
  }, [t]);

  const notificationIcon = useMemo(() => {
    return resolveAssistantAvatarUrl({
      apiClient,
      config,
      chatProfile
    });
  }, [apiClient, chatProfile, config]);

  const lastAssistantMessageId = useMemo(() => {
    return findLastAssistantLikeMessageId(messages);
  }, [messages]);

  const closeActiveNotification = useCallback(() => {
    activeNotificationRef.current?.close?.();
    activeNotificationRef.current = null;
  }, []);

  const emitNotification = useCallback(
    ({
      body,
      tag,
      fallbackMessage
    }: {
      body: string;
      tag: string;
      fallbackMessage: object;
    }) => {
      const embeddedInIframe = isEmbeddedInIframe();
      const notificationsSupported = supportsBrowserNotifications();
      const canUseNativeNotifications =
        !embeddedInIframe &&
        notificationsSupported &&
        Notification.permission === 'granted';

      if (!canUseNativeNotifications) {
        logNotificationEvent('Native notification unavailable, evaluating fallback.', {
          tag,
          embeddedInIframe,
          notificationsSupported,
          permission: notificationsSupported ? Notification.permission : 'unsupported'
        });

        if (embeddedInIframe && window.parent) {
          logNotificationEvent('Posting iframe fallback message to parent window.', {
            tag,
            fallbackMessage
          });
          window.parent.postMessage(fallbackMessage, '*');
        } else {
          logNotificationEvent('No fallback emitted for this notification.', {
            tag,
            reason: embeddedInIframe ? 'missing-parent-window' : 'native-notification-unavailable-outside-iframe'
          });
        }
        return;
      }

      logNotificationEvent('Showing native browser notification.', {
        tag,
        title: notificationTitle
      });
      closeActiveNotification();

      const notification = new Notification(notificationTitle, {
        body,
        icon: notificationIcon,
        tag
      });

      notification.onclose = () => {
        if (activeNotificationRef.current === notification) {
          activeNotificationRef.current = null;
        }
      };
      notification.onclick = () => {
        window.focus();
        notification.close?.();
      };

      activeNotificationRef.current = notification;
    },
    [closeActiveNotification, notificationIcon, notificationTitle]
  );

  useEffect(() => {
    return () => {
      closeActiveNotification();
    };
  }, [closeActiveNotification]);

  useEffect(() => {
    const embeddedInIframe = isEmbeddedInIframe();
    const notificationsSupported = supportsBrowserNotifications();
    const permission = notificationsSupported
      ? Notification.permission
      : 'unsupported';

    if (
      embeddedInIframe ||
      !notificationsSupported ||
      permission !== 'default'
    ) {
      logNotificationEvent('Skipping permission listener registration.', {
        embeddedInIframe,
        notificationsSupported,
        permission
      });
      return;
    }

    logNotificationEvent('Registering notification permission listeners.', {
      events: NOTIFICATION_PERMISSION_EVENTS
    });

    const requestPermission = (event: Event) => {
      if (Notification.permission !== 'default') {
        logNotificationEvent('Permission request skipped because permission already changed.', {
          eventType: event.type,
          permission: Notification.permission
        });
        return;
      }

      logNotificationEvent('Requesting notification permission after user interaction.', {
        eventType: event.type
      });
      void Notification.requestPermission()
        .then((nextPermission) => {
          logNotificationEvent('Notification permission request resolved.', {
            permission: nextPermission
          });
        })
        .catch(() => {});
      cleanup();
    };

    const cleanup = () => {
      for (const eventName of NOTIFICATION_PERMISSION_EVENTS) {
        window.removeEventListener(eventName, requestPermission);
      }
    };

    for (const eventName of NOTIFICATION_PERMISSION_EVENTS) {
      window.addEventListener(eventName, requestPermission, { passive: true });
    }

    return cleanup;
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        logNotificationEvent('Page became visible, closing active notification if present.');
        closeActiveNotification();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [closeActiveNotification]);

  useEffect(() => {
    const askKey = askUser
      ? `${askUser.spec.type}:${askUser.spec.step_id}`
      : undefined;
    const shouldNotify =
      Boolean(askKey) &&
      askKey !== previousAskKeyRef.current &&
      !isPageVisible();

    if (!askKey || !askUser) {
      if (previousAskKeyRef.current) {
        logNotificationEvent('Clearing ask notification state.', {
          previousAskKey: previousAskKeyRef.current
        });
      }
      previousAskKeyRef.current = undefined;
      closeActiveNotification();
      return;
    }

    logNotificationEvent('Evaluated ask notification candidate.', {
      askKey,
      askType: askUser.spec.type,
      stepId: askUser.spec.step_id,
      previousAskKey: previousAskKeyRef.current,
      pageVisible: isPageVisible(),
      shouldNotify
    });

    if (shouldNotify) {
      logNotificationEvent('Dispatching ask notification.', {
        askKey
      });
      emitNotification({
        body: notificationBody,
        tag: askKey,
        fallbackMessage: buildHumanInteractionWindowMessage({
          title: notificationTitle,
          body: notificationBody,
          icon: notificationIcon,
          ask: {
            type: askUser.spec.type,
            stepId: askUser.spec.step_id
          }
        })
      });
    }

    previousAskKeyRef.current = askKey;
  }, [
    askUser,
    emitNotification,
    notificationBody,
    notificationIcon,
    notificationTitle,
    closeActiveNotification
  ]);

  useEffect(() => {
    if (loading && !previousLoadingRef.current) {
      logNotificationEvent('Assistant task started.', {
        taskStartAssistantMessageId: lastAssistantMessageId
      });
      taskStartAssistantMessageIdRef.current = lastAssistantMessageId;
      sawAssistantOutputDuringTaskRef.current = false;
    }

    if (
      loading &&
      lastAssistantMessageId &&
      lastAssistantMessageId !== taskStartAssistantMessageIdRef.current
    ) {
      logNotificationEvent('Detected assistant output during running task.', {
        taskStartAssistantMessageId: taskStartAssistantMessageIdRef.current,
        lastAssistantMessageId
      });
      sawAssistantOutputDuringTaskRef.current = true;
    }

    if (!loading && previousLoadingRef.current) {
      const assistantTurnCompleted =
        Boolean(lastAssistantMessageId) &&
        lastAssistantMessageId !== taskStartAssistantMessageIdRef.current &&
        sawAssistantOutputDuringTaskRef.current;

      logNotificationEvent('Assistant task ended, evaluating completion notification.', {
        assistantTurnCompleted,
        lastAssistantMessageId,
        taskStartAssistantMessageId: taskStartAssistantMessageIdRef.current,
        sawAssistantOutputDuringTask: sawAssistantOutputDuringTaskRef.current,
        askActive: Boolean(askUser),
        pageVisible: isPageVisible()
      });

      if (
        assistantTurnCompleted &&
        !askUser &&
        !isPageVisible() &&
        lastAssistantMessageId
      ) {
        logNotificationEvent('Dispatching assistant turn completed notification.', {
          lastAssistantMessageId
        });
        emitNotification({
          body: notificationBody,
          tag: `${ASSISTANT_COMPLETION_TAG_PREFIX}${lastAssistantMessageId}`,
          fallbackMessage: buildAssistantTurnCompletedWindowMessage({
            title: notificationTitle,
            body: notificationBody,
            icon: notificationIcon,
            turn: {
              messageId: lastAssistantMessageId
            }
          })
        });
      }

      taskStartAssistantMessageIdRef.current = lastAssistantMessageId;
      sawAssistantOutputDuringTaskRef.current = false;
    }

    previousLoadingRef.current = loading;
  }, [
    askUser,
    emitNotification,
    lastAssistantMessageId,
    loading,
    notificationIcon,
    notificationBody,
    notificationTitle
  ]);
}
