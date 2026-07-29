import { Trash2 } from 'lucide-react';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { toast } from 'sonner';

import {
  ChainlitContext,
  ClientError,
  threadHistoryState,
  useChatData,
  useChatInteract,
  useChatMessages,
  useChatSession,
  useConfig
} from '@chainlit/react-client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { Translator } from '../i18n';

/**
 * Resolve the open conversation id for bulk-delete exclusion.
 * Prefer the live session thread, then resume target, then sidebar selection
 * (URL can mark current before currentThreadIdState is hydrated).
 */
function resolveCurrentThreadId(
  threadId?: string,
  idToResume?: string,
  historyCurrentThreadId?: string
): string | null {
  for (const candidate of [threadId, idToResume, historyCurrentThreadId]) {
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    if (value) {
      return value;
    }
  }
  return null;
}

export default function DeleteThreadsButton() {
  const apiClient = useContext(ChainlitContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { clear } = useChatInteract();
  const { threadId } = useChatMessages();
  const { idToResume } = useChatSession();
  const { config } = useConfig();
  const {
    conversationHistoryVisible,
    conversationHistoryShowDeleteThreads,
    projectId
  } = useChatData();
  const [threadHistory, setThreadHistory] = useRecoilState(threadHistoryState);
  const [open, setOpen] = useState(false);

  const keepThreadId = resolveCurrentThreadId(
    threadId,
    idToResume,
    threadHistory?.currentThreadId
  );
  const threads = threadHistory?.threads || [];
  const deletableCount = threads.filter(
    (thread) => thread.id !== keepThreadId
  ).length;

  if (
    conversationHistoryVisible === false ||
    conversationHistoryShowDeleteThreads === false
  ) {
    return null;
  }

  const disabled = !config?.dataPersistence || deletableCount === 0;
  const scopeKey = projectId ? 'project' : 'bag';

  const handleDeleteThreads = () => {
    toast.promise(apiClient.deleteThreads(projectId, keepThreadId), {
      loading: t(
        `threadHistory.sidebar.actions.deleteAll.${scopeKey}.inProgress`
      ),
      success: () => {
        setOpen(false);
        const keepId = keepThreadId || undefined;
        setThreadHistory((prev) => {
          const remaining = keepId
            ? (prev?.threads || []).filter((thread) => thread.id === keepId)
            : [];
          return {
            ...prev,
            currentThreadId: keepId,
            pageInfo: keepId
              ? {
                  hasNextPage: false,
                  startCursor: keepId,
                  endCursor: keepId
                }
              : undefined,
            threads: remaining,
            timeGroupedThreads: undefined
          };
        });
        // Only reset the chat surface when there was no current thread to keep.
        if (!keepId) {
          clear();
          navigate(
            { pathname: '/', search: window.location.search },
            { replace: true }
          );
        }
        return t(`threadHistory.sidebar.actions.deleteAll.${scopeKey}.success`);
      },
      error: (err) => {
        if (err instanceof ClientError) {
          return <span>{err.message}</span>;
        }
        return <span />;
      }
    });
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="delete-all-threads-button"
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive disabled:opacity-40 dark:hover:text-red-400"
              onClick={() => setOpen(true)}
            >
              <Trash2 className="!size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(`threadHistory.sidebar.actions.deleteAll.${scopeKey}.tooltip`)}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-destructive/70 dark:border-red-400/70">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive dark:text-red-500">
              {t(`threadHistory.sidebar.actions.deleteAll.${scopeKey}.title`)}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                {t(
                  `threadHistory.sidebar.actions.deleteAll.${scopeKey}.description`,
                  projectId ? { project: projectId } : undefined
                )}
              </span>
              <span className="block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-medium text-destructive dark:border-red-400/50 dark:bg-red-500/15 dark:text-red-200">
                {t(`threadHistory.sidebar.actions.deleteAll.${scopeKey}.warning`)}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-0">
              <Translator path="common.actions.cancel" />
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"
              onClick={handleDeleteThreads}
            >
              {t(`threadHistory.sidebar.actions.deleteAll.${scopeKey}.confirm`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
