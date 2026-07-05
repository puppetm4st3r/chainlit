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

const labels = {
  tooltip: 'Delete all threads',
  title: 'Delete all threads?',
  description: 'This will permanently delete every thread in your history.',
  warning:
    'This action cannot be undone. Messages, elements, and feedback associated with these threads will be removed.',
  confirm: 'Delete all threads',
  inProgress: 'Deleting all threads',
  success: 'All threads deleted'
};

export default function DeleteThreadsButton() {
  const apiClient = useContext(ChainlitContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { clear } = useChatInteract();
  const { threadId } = useChatMessages();
  const { config } = useConfig();
  const { conversationHistoryVisible } = useChatData();
  const [threadHistory, setThreadHistory] = useRecoilState(threadHistoryState);
  const [open, setOpen] = useState(false);

  const hasThreads = Boolean(threadHistory?.threads?.length);

  if (conversationHistoryVisible === false) {
    return null;
  }

  const disabled = !config?.dataPersistence || !hasThreads;

  const handleDeleteThreads = () => {
    toast.promise(apiClient.deleteThreads(), {
      loading: t('threadHistory.sidebar.actions.deleteAll.inProgress', {
        defaultValue: labels.inProgress
      }),
      success: () => {
        setOpen(false);
        setThreadHistory((prev) => ({
          ...prev,
          currentThreadId: undefined,
          pageInfo: undefined,
          threads: [],
          timeGroupedThreads: {}
        }));
        if (threadId) {
          clear();
        }
        navigate('/', { replace: true });
        return t('threadHistory.sidebar.actions.deleteAll.success', {
          defaultValue: labels.success
        });
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
            {t('threadHistory.sidebar.actions.deleteAll.tooltip', {
              defaultValue: labels.tooltip
            })}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-destructive/70 dark:border-red-400/70">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive dark:text-red-500">
              {t('threadHistory.sidebar.actions.deleteAll.title', {
                defaultValue: labels.title
              })}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                {t('threadHistory.sidebar.actions.deleteAll.description', {
                  defaultValue: labels.description
                })}
              </span>
              <span className="block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-medium text-destructive dark:border-red-400/50 dark:bg-red-500/15 dark:text-red-200">
                {t('threadHistory.sidebar.actions.deleteAll.warning', {
                  defaultValue: labels.warning
                })}
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
              {t('threadHistory.sidebar.actions.deleteAll.confirm', {
                defaultValue: labels.confirm
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
