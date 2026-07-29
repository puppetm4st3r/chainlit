import { cn } from '@/lib/utils';
import { size } from 'lodash';
import { ChevronDown, Share2 } from 'lucide-react';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { toast } from 'sonner';

import {
  ChainlitContext,
  ClientError,
  ThreadHistory, // sessionIdState,
  threadHistoryState,
  useChatData,
  useChatInteract,
  useChatMessages,
  useChatSession,
  useConfig
} from '@chainlit/react-client';

import Alert from '@/components/Alert';
import { Loader } from '@/components/Loader';
import ShareDialog from '@/components/share/ShareDialog';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { Translator } from '../i18n';
import MoveThreadProjectDialog from './MoveThreadProjectDialog';
import ThreadOptions from './ThreadOptions';

interface ThreadListProps {
  threadHistory?: ThreadHistory;
  error?: string;
  isFetching: boolean;
  isLoadingMore: boolean;
}

type ThreadWithProfile = {
  metadata?: Record<string, any> | string | null;
  tags?: string[] | null;
};

/**
 * Resolve the chat profile associated with a historical thread.
 * Prefers metadata.chat_profile and falls back to a matching configured tag.
 */
const getThreadMetadata = (
  thread: ThreadWithProfile
): Record<string, any> => {
  if (!thread.metadata) {
    return {};
  }

  if (typeof thread.metadata === 'string') {
    try {
      const parsedMetadata = JSON.parse(thread.metadata);
      return parsedMetadata && typeof parsedMetadata === 'object'
        ? parsedMetadata
        : {};
    } catch {
      return {};
    }
  }

  return thread.metadata;
};

/**
 * Return the chat profile name for a thread, or undefined when unknown.
 */
const getThreadProfileName = (
  thread: ThreadWithProfile,
  configuredProfileNames: Set<string>
) => {
  const metadata = getThreadMetadata(thread);
  const metadataProfileName = metadata.chat_profile;

  if (typeof metadataProfileName === 'string' && metadataProfileName.trim()) {
    return metadataProfileName;
  }

  return thread.tags?.find((tag) => configuredProfileNames.has(tag));
};

export function ThreadList({
  threadHistory,
  error,
  isFetching,
  isLoadingMore
}: ThreadListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { idToResume, chatProfile } = useChatSession();
  const { clear } = useChatInteract();
  const { threadId: currentThreadId } = useChatMessages();
  const { loading: agentGenerating } = useChatData();
  const [threadIdToDelete, setThreadIdToDelete] = useState<string>();
  const [threadIdToRename, setThreadIdToRename] = useState<string>();
  const [threadNewName, setThreadNewName] = useState<string>();
  const [threadIdToMove, setThreadIdToMove] = useState<string>();
  const [threadProjectIdToMove, setThreadProjectIdToMove] = useState<
    string | null
  >();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {}
  );
  const setThreadHistory = useSetRecoilState(threadHistoryState);
  const apiClient = useContext(ChainlitContext);
  const { config } = useConfig();
  const dataPersistence = config?.dataPersistence;
  const threadSharingReady = Boolean((config as any)?.threadSharing);
  // sessionId not needed here

  // Share thread state
  const [threadIdToShare, setThreadIdToShare] = useState<string | undefined>();
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  // Share dialog state is centralized in ShareDialog; we only track which thread to share

  const handleShareThread = (threadId: string) => {
    if (!threadSharingReady) return;
    setThreadIdToShare(threadId);
    setIsShareDialogOpen(true);
    // ShareDialog handles its own internal state; we just open it
  };

  const configuredProfileNames = useMemo(
    () => new Set((config?.chatProfiles || []).map((profile) => profile.name)),
    [config?.chatProfiles]
  );

  /**
   * Keep only threads that belong to the currently selected agent profile.
   * Filter whenever a profile is selected, even if chatProfiles failed to load
   * (metadata.chat_profile is still enough to match).
   */
  const filteredTimeGroupedThreads = useMemo(() => {
    const groups = threadHistory?.timeGroupedThreads;
    if (!groups) {
      return undefined;
    }

    if (!chatProfile) {
      return groups;
    }

    const filtered: typeof groups = {};
    for (const [group, items] of Object.entries(groups)) {
      const matchingItems = items.filter(
        (thread) =>
          getThreadProfileName(thread, configuredProfileNames) === chatProfile
      );
      if (matchingItems.length > 0) {
        filtered[group] = matchingItems;
      }
    }
    return filtered;
  }, [
    threadHistory?.timeGroupedThreads,
    chatProfile,
    configuredProfileNames
  ]);

  type ParsedGroupLabel = {
    month: string;
    year: number;
    raw: string;
  };

  const getMonthMap = (
    locale = navigator.language
  ): { map: Record<string, number>; monthRegex: RegExp } => {
    const map: Record<string, number> = {};
    const monthNames: string[] = [];

    for (let i = 0; i < 12; i++) {
      const d = new Date(2020, i, 1);

      const long = d
        .toLocaleDateString(locale, { month: 'long' })
        .toLocaleLowerCase(locale);

      map[long] = i;
      monthNames.push(long);
    }
    const monthRegex = new RegExp(`\\b(${monthNames.join('|')})\\b`, 'i');
    return { map, monthRegex };
  };

  const { map: monthMap, monthRegex } = useMemo<{
    map: Record<string, number>;
    monthRegex: RegExp;
  }>(() => getMonthMap(), []);

  const parseGroupLabel = (label: string): ParsedGroupLabel | null => {
    const locale = navigator.language;

    const matchMonth = label.toLocaleLowerCase(locale).match(monthRegex);
    if (!matchMonth) return null;
    const month = matchMonth[0];

    const matchYear = label.match(/\d{4}/);
    if (!matchYear) return null;
    const year = Number(matchYear[0]);

    if (isNaN(year)) return null;

    return { month, year, raw: label };
  };

  const sortGroupsByDate = (a: string, b: string): number => {
    const aParsed = parseGroupLabel(a);
    const bParsed = parseGroupLabel(b);

    if (!aParsed || !bParsed) return a.localeCompare(b);

    if (aParsed.year !== bParsed.year) {
      return bParsed.year - aParsed.year;
    }
    const aMonth = monthMap[aParsed.month] ?? -1;
    const bMonth = monthMap[bParsed.month] ?? -1;

    return bMonth - aMonth;
  };

  const sortedTimeGroupKeys = useMemo(() => {
    if (!filteredTimeGroupedThreads) return [];
    const fixedOrder = [
      'Today',
      'Yesterday',
      'Previous 7 days',
      'Previous 30 days'
    ];
    return Object.keys(filteredTimeGroupedThreads).sort((a, b) => {
      const aIndex = fixedOrder.indexOf(a);
      const bIndex = fixedOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return sortGroupsByDate(a, b);
    });
  }, [filteredTimeGroupedThreads]);

  if (isFetching || (!filteredTimeGroupedThreads && isLoadingMore)) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" className="m-3">
        {error}
      </Alert>
    );
  }

  if (!threadHistory || size(filteredTimeGroupedThreads) === 0) {
    return (
      <Alert variant="info" className="m-3">
        <Translator path="threadHistory.sidebar.empty" />
      </Alert>
    );
  }

  const handleDeleteThread = async () => {
    if (!threadIdToDelete) return;
    const isDeletingCurrentThread =
      threadIdToDelete === idToResume ||
      threadIdToDelete === currentThreadId;

    toast.promise(apiClient.deleteThread(threadIdToDelete), {
      loading: (
        <Translator path="threadHistory.thread.actions.delete.inProgress" />
      ),
      success: () => {
        setThreadHistory((prev) => ({
          ...prev,
          currentThreadId:
            prev?.currentThreadId === threadIdToDelete
              ? undefined
              : prev?.currentThreadId,
          threads: prev?.threads?.filter((t) => t.id !== threadIdToDelete)
        }));
        if (isDeletingCurrentThread) {
          clear();
        }
        navigate(
          { pathname: '/', search: window.location.search },
          { replace: isDeletingCurrentThread }
        );
        return (
          <Translator path="threadHistory.thread.actions.delete.success" />
        );
      },
      error: (err) => {
        if (err instanceof ClientError) {
          return <span>{err.message}</span>;
        } else {
          return <span></span>;
        }
      }
    });
  };

  const handleRenameThread = () => {
    if (!threadIdToRename || !threadNewName) return;

    toast.promise(apiClient.renameThread(threadIdToRename, threadNewName), {
      loading: (
        <Translator path="threadHistory.thread.actions.rename.inProgress" />
      ),
      success: () => {
        setThreadNewName(undefined);
        setThreadIdToRename(undefined);
        setThreadHistory((prev) => {
          const next = {
            ...prev,
            threads: prev?.threads ? [...prev.threads] : undefined
          };
          const threadIndex = next.threads?.findIndex(
            (t) => t.id === threadIdToRename
          );
          if (typeof threadIndex === 'number' && next.threads) {
            next.threads[threadIndex] = {
              ...next.threads[threadIndex],
              name: threadNewName
            };
          }
          return next;
        });
        return (
          <div>
            <Translator path="threadHistory.thread.actions.rename.success" />
          </div>
        );
      },
      error: (err) => {
        if (err instanceof ClientError) {
          return <span>{err.message}</span>;
        } else {
          return <span></span>;
        }
      }
    });
  };

  const handleThreadMoved = (movedThreadId: string, _projectId: string) => {
    setThreadHistory((prev) => ({
      ...prev,
      threads: prev?.threads?.filter((thread) => thread.id !== movedThreadId)
    }));
    setThreadIdToMove(undefined);
    setThreadProjectIdToMove(undefined);
  };

  const getTimeGroupLabel = (group: string) => {
    const labels = {
      Today: <Translator path="threadHistory.sidebar.timeframes.today" />,
      Yesterday: (
        <Translator path="threadHistory.sidebar.timeframes.yesterday" />
      ),
      'Previous 7 days': (
        <Translator path="threadHistory.sidebar.timeframes.previous7days" />
      ),
      'Previous 30 days': (
        <Translator path="threadHistory.sidebar.timeframes.previous30days" />
      )
    };
    return labels[group as keyof typeof labels] || group;
  };

  const isGroupCollapsed = (group: string) => collapsedGroups[group] ?? false;

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !(prev[group] ?? false)
    }));
  };

  return (
    <>
      <AlertDialog
        open={!!threadIdToDelete}
        onOpenChange={() => setThreadIdToDelete(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Translator path="threadHistory.thread.actions.delete.title" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Translator path="threadHistory.thread.actions.delete.description" />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-0">
              <Translator path="common.actions.cancel" />
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteThread}>
              <Translator path="common.actions.confirm" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!threadIdToRename}
        onOpenChange={() => setThreadIdToRename(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Translator path="threadHistory.thread.actions.rename.title" />
            </DialogTitle>
            <DialogDescription>
              <Translator path="threadHistory.thread.actions.rename.description" />
            </DialogDescription>
          </DialogHeader>
          <div className="my-6">
            <Label htmlFor="name" className="text-right">
              <Translator path="threadHistory.thread.actions.rename.form.name.label" />
            </Label>
            <Input
              id="name"
              required
              value={threadNewName}
              onChange={(e) => setThreadNewName(e.target.value)}
              placeholder={t(
                'threadHistory.thread.actions.rename.form.name.placeholder'
              )}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setThreadIdToRename(undefined)}
            >
              <Translator path="common.actions.cancel" />
            </Button>
            <Button type="button" onClick={handleRenameThread}>
              <Translator path="common.actions.confirm" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={(open) => {
          setIsShareDialogOpen(open);
          if (!open) {
            setThreadIdToShare(undefined);
          }
        }}
        threadId={threadIdToShare || null}
      />
      <MoveThreadProjectDialog
        open={Boolean(threadIdToMove)}
        threadId={threadIdToMove}
        currentProjectId={threadProjectIdToMove}
        onOpenChange={(open) => {
          if (!open) {
            setThreadIdToMove(undefined);
            setThreadProjectIdToMove(undefined);
          }
        }}
        onMoved={handleThreadMoved}
      />
      <TooltipProvider delayDuration={300}>
        {sortedTimeGroupKeys.map((group, groupIndex) => {
          const items = filteredTimeGroupedThreads![group];
          const groupCollapsed = isGroupCollapsed(group);
          return (
            <SidebarGroup
              key={group}
              className={cn(groupIndex === 0 && 'pt-1')}
            >
              <SidebarGroupLabel className="h-auto px-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="grid w-full grid-cols-[0.875rem_1fr_auto_1fr_0.875rem] items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-sidebar-foreground/80 outline-none ring-sidebar-ring transition-colors hover:text-sidebar-foreground focus-visible:ring-2"
                >
                  <span className="h-3.5 w-3.5" aria-hidden="true" />
                  <span
                    className="h-px bg-sidebar-border/70"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 shrink-0 text-center tracking-[0.04em]">
                    {getTimeGroupLabel(group)}
                  </span>
                  <span
                    className="h-px bg-sidebar-border/70"
                    aria-hidden="true"
                  />
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60 transition-transform duration-200',
                      groupCollapsed && '-rotate-90'
                    )}
                    aria-hidden="true"
                  />
                </button>
              </SidebarGroupLabel>
              {!groupCollapsed ? (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((thread) => {
                      const isResumed =
                        idToResume === thread.id &&
                        !threadHistory!.currentThreadId;
                      const isSelected =
                        isResumed || threadHistory!.currentThreadId === thread.id;
                      const threadMetadata = getThreadMetadata(thread);
                      return (
                        <SidebarMenuItem
                          key={thread.id}
                          id={`thread-${thread.id}`}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                to={
                                  isResumed
                                    ? ''
                                    : {
                                        pathname: `/thread/${thread.id}`,
                                        search: window.location.search
                                      }
                                }
                              >
                                <SidebarMenuButton
                                  isActive={isSelected}
                                  className="relative group/thread"
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2 pr-10">
                                    {threadMetadata.is_shared ? (
                                      <Share2
                                        className="h-4 w-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                    <span className="min-w-0 flex-1 truncate">
                                      {thread.name || (
                                        <Translator path="threadHistory.thread.untitled" />
                                      )}
                                    </span>
                                  </span>
                                  <ThreadOptions
                                    onDelete={() =>
                                      setThreadIdToDelete(thread.id)
                                    }
                                    onRename={() => {
                                      setThreadIdToRename(thread.id);
                                      setThreadNewName(thread.name);
                                    }}
                                    onMove={
                                      dataPersistence
                                        ? () => {
                                            setThreadIdToMove(thread.id);
                                            setThreadProjectIdToMove(
                                              thread.projectId ?? null
                                            );
                                          }
                                        : undefined
                                    }
                                    moveDisabled={agentGenerating}
                                    onShare={
                                      dataPersistence && threadSharingReady
                                        ? () => handleShareThread(thread.id)
                                        : undefined
                                    }
                                    className={cn(
                                      'absolute z-20 bottom-0 top-0 right-0 bg-sidebar-accent hover:bg-sidebar-accent hover:text-primary flex opacity-0 group-hover/thread:opacity-100',
                                      isSelected &&
                                        'bg-sidebar-accent opacity-100'
                                    )}
                                  />
                                </SidebarMenuButton>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center">
                              <p>{thread.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              ) : null}
            </SidebarGroup>
          );
        })}
      </TooltipProvider>
      {isLoadingMore ? (
        <div className="flex items-center justify-center p-2">
          <Loader />
        </div>
      ) : null}
    </>
  );
}
