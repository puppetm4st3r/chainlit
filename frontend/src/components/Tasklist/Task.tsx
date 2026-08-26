import { Markdown } from '@/components/Markdown';
import { memo } from 'react';

import { TaskStatusIcon } from './TaskStatusIcon';

export interface ITask {
  title: string;
  status: 'ready' | 'running' | 'done' | 'failed';
  forId?: string;
}

export interface ITaskList {
  title?: string;
  status: string;
  tasks: ITask[];
}

interface TaskProps {
  task: ITask;
  allowHtml?: boolean;
  latex?: boolean;
}

interface TaskTitleProps {
  title: string;
  allowHtml?: boolean;
  latex?: boolean;
}

/** Cheap gate: Hybrid RAG / plain titles skip the full remark pipeline. */
const MARKDOWN_HINT_RE = /[*_`#[\]|>~]|https?:\/\/|^\s*[-+]\s|\n/;

/**
 * Markdown title isolated from status-icon updates so TaskList progress pulses
 * do not re-parse every row on each SWR snapshot. Plain strings render as text.
 */
const TaskTitle = memo(function TaskTitle({
  title,
  allowHtml,
  latex
}: TaskTitleProps) {
  const titleClassName =
    'task-title max-w-none prose-sm text-xs text-left break-words font-normal [&_*]:font-normal [&_*]:text-xs [&_p]:m-0 [&_p]:leading-snug [&_div]:leading-snug [&_div]:mt-0';

  if (!allowHtml && !latex && !MARKDOWN_HINT_RE.test(title)) {
    return (
      <div className={titleClassName}>
        <p className="m-0 leading-snug">{title}</p>
      </div>
    );
  }

  return (
    <Markdown allowHtml={allowHtml} latex={latex} className={titleClassName}>
      {title}
    </Markdown>
  );
});

/**
 * One TaskList row: status icon + title.
 *
 * Title color is owned by CSS (``.task-title`` under ``.task-status-*``):
 * completed/done → foreground; every other status → muted. Do not set Tailwind
 * color / text-inherit utilities here — they fight Markdown ``prose``.
 */
export const Task = memo(function Task({ task, allowHtml, latex }: TaskProps) {
  const handleClick = () => {
    if (task.forId) {
      const parent = document.getElementById(`step-${task.forId}`);
      if (parent) {
        const child = parent.querySelector('div');
        if (child) {
          const clearFlash = () => {
            child.classList.remove('task-step-flash');
            child.removeEventListener('animationend', clearFlash);
          };
          child.classList.remove('task-step-flash');
          void child.offsetWidth;
          child.classList.add('task-step-flash');
          child.addEventListener('animationend', clearFlash);
          parent.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'start'
          });
        }
      }
    }
  };

  return (
    <div
      className={`task task-status-${task.status}`}
      data-task-status={task.status}
    >
      <div
        className={`w-full grid grid-cols-[auto_1fr] items-start gap-2.5 font-normal py-0.5 px-1 text-xs leading-tight ${
          task.forId ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={handleClick}
      >
        <div className="flex w-4 shrink-0 items-start justify-center pt-[1px]">
          <TaskStatusIcon status={task.status} />
        </div>
        <div className="min-w-0">
          <TaskTitle
            title={task.title}
            allowHtml={allowHtml}
            latex={latex}
          />
        </div>
      </div>
    </div>
  );
});
