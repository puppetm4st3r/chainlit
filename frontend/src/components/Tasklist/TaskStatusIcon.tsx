import { Check, X } from 'lucide-react';

import type { ITask } from './Task';

/**
 * Static status glyphs for TaskList rows (no spinners / motion).
 *
 * - ready (waiting) → no icon
 * - running → muted gray check
 * - done → green check
 * - failed → red X
 */
export const TaskStatusIcon = ({ status }: { status: ITask['status'] }) => {
  switch (status) {
    case 'running':
      return <Check className="!size-4 text-muted-foreground mt-[1px]" />;
    case 'done':
      return <Check className="!size-4 text-green-500 mt-[1px]" />;
    case 'failed':
      return <X className="!size-4 text-red-500 mt-[1px]" />;
    case 'ready':
    default:
      return null;
  }
};
