import { cn } from '@/lib/utils';
import * as ResizablePrimitive from 'react-resizable-panels';

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
      className
    )}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle = true,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      'group relative flex w-3 shrink-0 items-center justify-center bg-transparent focus-visible:outline-none',
      'data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-full',
      'before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-muted-foreground/20 before:transition-colors before:duration-200',
      'hover:before:bg-muted-foreground/30 data-[resize-handle-state=drag]:before:bg-ring/55',
      'data-[panel-group-direction=vertical]:before:inset-x-0 data-[panel-group-direction=vertical]:before:left-0 data-[panel-group-direction=vertical]:before:top-1/2 data-[panel-group-direction=vertical]:before:h-px data-[panel-group-direction=vertical]:before:w-full data-[panel-group-direction=vertical]:before:-translate-y-1/2 data-[panel-group-direction=vertical]:before:translate-x-0',
      'cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize',
      'focus-visible:before:bg-ring/55',
      className
    )}
    {...props}
  >
    {withHandle && (
      <div
        className={cn(
          'pointer-events-none z-10 h-10 w-1 rounded-full border border-border bg-muted shadow-sm transition-all duration-200 ease-out',
          'group-hover:scale-125 group-hover:border-muted-foreground group-hover:bg-muted-foreground group-hover:shadow-md',
          'group-data-[resize-handle-state=drag]:scale-125 group-data-[resize-handle-state=drag]:border-ring group-data-[resize-handle-state=drag]:bg-ring group-data-[resize-handle-state=drag]:shadow-md',
          'data-[panel-group-direction=vertical]:h-1 data-[panel-group-direction=vertical]:w-10',
          'data-[panel-group-direction=vertical]:origin-center'
        )}
      />
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
