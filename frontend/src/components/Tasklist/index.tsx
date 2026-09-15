import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import useSWR from 'swr';

import {
  tasklistState,
  useChatInteract,
  useConfig
} from '@chainlit/react-client';

import { useTranslation } from '@/components/i18n/Translator';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ResizableHandle, ResizablePanel } from '@/components/ui/resizable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { ITask, ITaskList, Task } from './Task';

/** Matches ``Page`` ``DEFAULT_TASKLIST_PANEL_SIZE`` for the right dock. */
const TASKLIST_PANEL_DEFAULT_SIZE = 30;

interface HeaderProps {
  title: string;
  statusLabel: string;
  processing: boolean;
  canDismiss: boolean;
  closeLabel: string;
  closeDisabledTooltip: string;
  onDismiss: () => void;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

/**
 * TaskList can be dismissed only when every row is terminal (done/failed),
 * or when the checklist is empty.
 */
const isTaskListDismissible = (tasks: ITask[] | undefined): boolean => {
  const list = tasks || [];
  if (list.length === 0) return true;
  return list.every(
    (task) => task.status === 'done' || task.status === 'failed'
  );
};

/** True while any checklist row is actively running. */
const isTaskListProcessing = (tasks: ITask[] | undefined): boolean =>
  (tasks || []).some((task) => task.status === 'running');

/**
 * Terminal badge from task statuses using locale strings (not backend badge text).
 * Priority matches TaskList badge rules: failed > all done > pending leftovers.
 */
const terminalStatusLabel = (
  tasks: ITask[] | undefined,
  labels: { failed: string; done: string; pending: string }
): string => {
  const list = tasks || [];
  if (list.some((task) => task.status === 'failed')) {
    return labels.failed;
  }
  if (list.length > 0 && list.every((task) => task.status === 'done')) {
    return labels.done;
  }
  if (list.some((task) => task.status === 'ready')) {
    return labels.pending;
  }
  return '';
};

interface StatusLineProps {
  label: string;
  processing: boolean;
}

/**
 * Compact status under the panel title: locale label when idle/done, or
 * braille spinner + locale processing label while tasks are running.
 */
const StatusLine = ({ label, processing }: StatusLineProps) => {
  if (!label && !processing) return null;

  return (
    <div
      className="font-mono text-[11px] leading-none text-muted-foreground"
      aria-live="polite"
    >
      {processing ? (
        <span className="tasklist-status-spinner" aria-hidden="true" />
      ) : null}
      {processing ? <span> </span> : null}
      <span>{label}</span>
    </div>
  );
};

const Header = ({
  title,
  statusLabel,
  processing,
  canDismiss,
  closeLabel,
  closeDisabledTooltip,
  onDismiss
}: HeaderProps) => {
  const tooltip = canDismiss ? closeLabel : closeDisabledTooltip;

  return (
    <div className="flex shrink-0 flex-row items-center justify-between gap-2 border-b px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="min-w-0 truncate text-sm font-bold leading-tight">
          {title}
        </div>
        <StatusLine label={statusLabel} processing={processing} />
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Span keeps tooltip usable while the button is disabled. */}
            <span className="inline-flex shrink-0 self-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canDismiss}
                aria-label={closeLabel}
                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-40"
                onClick={onDismiss}
              >
                <X className="!size-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

interface FooterProps {
  completedLabel: string;
}

const Footer = ({ completedLabel }: FooterProps) => {
  return (
    <div className="flex shrink-0 border-t px-3 py-2">
      <div className="w-full text-xs text-muted-foreground">{completedLabel}</div>
    </div>
  );
};

interface TaskListProps {
  isMobile: boolean;
  isCopilot?: boolean;
}

const TaskList = ({ isMobile, isCopilot }: TaskListProps) => {
  // Subscribe only to tasklistState so progressive checklist updates do not
  // re-render every useChatData() consumer (chat, composer, header, …).
  const tasklists = useRecoilValue(tasklistState);
  const tasklist = tasklists[tasklists.length - 1];
  const { config } = useConfig();
  const { windowMessage } = useChatInteract();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const allowHtml = config?.features?.unsafe_allow_html;
  const latex = config?.features?.latex;

  const { error, data, isLoading } = useSWR<ITaskList>(tasklist?.url, fetcher, {
    keepPreviousData: true
  });

  // Socket updates already cache-bust `tasklist.url` (`_ts=…`), which changes the
  // SWR key and refetches once. Do not call mutate() again on the same tick.

  const content = data as ITaskList | undefined;
  const tasks = content?.tasks;
  const defaultTitle = t('components.TaskList.defaultTitle');
  const panelTitle = (content?.title || '').trim() || defaultTitle;
  const completedCount = (tasks || []).filter(
    (task) => task.status === 'done'
  ).length;
  const completedLabel = t('components.TaskList.completedCount', {
    count: completedCount
  });
  const closeLabel = t('components.TaskList.close');
  const closeDisabledTooltip = t('components.TaskList.closeDisabledTooltip');
  const processingFallback = t('components.TaskList.processing');
  const canDismiss = isTaskListDismissible(tasks);
  const processing = isTaskListProcessing(tasks);
  const statusLabel = processing
    ? processingFallback
    : terminalStatusLabel(tasks, {
        failed: t('components.TaskList.failed'),
        done: t('components.TaskList.done'),
        pending: t('components.TaskList.pending')
      });

  const handleDismiss = () => {
    if (!canDismiss || !tasklist?.id) return;
    // Backend owns clear + remove_element; avoid optimistic local removal so a
    // dismiss_rejected race cannot hide a still-active checklist.
    windowMessage({ type: 'tasklist:clear', id: tasklist.id });
  };

  // Scroll only when a row newly becomes terminal (done/failed). Ignore inserts
  // of running/ready rows so the viewport follows the last completion, not the
  // last appended task. Never scroll upward: only advance when the target sits
  // below the current scroll position.
  const prevTaskStatusesRef = useRef<string[]>([]);
  const prevTasklistIdRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const list = tasks || [];
    const statuses = list.map((task) => task.status);
    const tasklistId = tasklist?.id;
    if (prevTasklistIdRef.current !== tasklistId || list.length === 0) {
      prevTasklistIdRef.current = tasklistId;
      prevTaskStatusesRef.current = [];
    }
    const previous = prevTaskStatusesRef.current;
    let newestTerminalIndex: number | null = null;
    for (let index = 0; index < statuses.length; index += 1) {
      const current = statuses[index];
      const prior = previous[index];
      const isTerminal = current === 'done' || current === 'failed';
      const wasTerminal = prior === 'done' || prior === 'failed';
      if (isTerminal && !wasTerminal) {
        newestTerminalIndex = index;
      }
    }
    prevTaskStatusesRef.current = statuses;
    if (el == null || newestTerminalIndex == null) return;

    const rows = el.querySelectorAll('[data-task-status]');
    const target = rows[newestTerminalIndex];
    if (!(target instanceof HTMLElement)) return;

    // Center the completed row, but never scroll the panel upward.
    const nextTop = Math.max(
      0,
      target.offsetTop - el.clientHeight / 2 + target.clientHeight / 2
    );
    if (nextTop <= el.scrollTop) {
      return;
    }
    el.scrollTo({ top: nextTop, behavior: 'auto' });
  }, [tasklist?.id, tasklist?.url, tasks]);

  if (!tasklist?.url) return null;

  if (isLoading && !data) {
    return null;
  }

  if (error) {
    return null;
  }

  if (!content) return null;

  const header = (
    <Header
      title={panelTitle}
      statusLabel={statusLabel}
      processing={processing}
      canDismiss={canDismiss}
      closeLabel={closeLabel}
      closeDisabledTooltip={closeDisabledTooltip}
      onDismiss={handleDismiss}
    />
  );

  if (isMobile) {
    // Get the first running or ready task, or the latest task
    let highlightedTaskIndex = (tasks?.length || 1) - 1;
    for (let i = 0; i < (tasks?.length || 0); i++) {
      if (tasks![i].status === 'running' || tasks![i].status === 'ready') {
        highlightedTaskIndex = i;
        break;
      }
    }
    const highlightedTask = tasks?.[highlightedTaskIndex];

    return (
      <aside
        className={cn('w-full tasklist-mobile', !isCopilot && 'md:hidden')}
      >
        <Card className="overflow-hidden">
          {header}
          {highlightedTask && (
            <CardContent className="p-2.5">
              <Task
                task={highlightedTask}
                allowHtml={allowHtml}
                latex={latex}
              />
            </CardContent>
          )}
          <Footer completedLabel={completedLabel} />
        </Card>
      </aside>
    );
  }

  // Desktop: full-height right dock (not a floating rounded card). Shares the
  // ResizablePanelGroup in Page with the chat column, same pattern as ElementSideView.
  return (
    <>
      <ResizableHandle className="hidden md:flex" />
      <ResizablePanel
        minSize={15}
        defaultSize={TASKLIST_PANEL_DEFAULT_SIZE}
        className="hidden h-full min-h-0 flex-col md:flex"
      >
        <aside className="tasklist flex h-full min-h-0 w-full flex-col border-l bg-card">
          {header}
          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2.5"
          >
            {tasks?.map((task, index) => (
              <Task
                key={task.forId || `${index}:${task.title}`}
                task={task}
                allowHtml={allowHtml}
                latex={latex}
              />
            ))}
          </div>
          <Footer completedLabel={completedLabel} />
        </aside>
      </ResizablePanel>
    </>
  );
};

export { TaskList };
