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
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      'group relative flex w-3 shrink-0 items-center justify-center bg-transparent focus-visible:outline-none',
      'data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-full',
      'after:pointer-events-none after:absolute after:left-1/2 after:h-12 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-muted-foreground/20 after:transition-all after:duration-200',
      'hover:after:bg-muted-foreground/30 data-[resize-handle-state=drag]:after:h-14 data-[resize-handle-state=drag]:after:bg-ring/55',
      'data-[panel-group-direction=vertical]:after:left-auto data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:h-1.5 data-[panel-group-direction=vertical]:after:w-12 data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0',
      'data-[panel-group-direction=vertical]:hover:after:w-14 data-[panel-group-direction=vertical]:data-[resize-handle-state=drag]:after:w-16',
      'cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize',
      'focus-visible:after:bg-ring/55',
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 h-12 w-1.5 rounded-full bg-muted-foreground/20 transition-all duration-200 group-hover:bg-muted-foreground/30 group-data-[resize-handle-state=drag]:h-14 group-data-[resize-handle-state=drag]:bg-ring/55 data-[panel-group-direction=vertical]:h-1.5 data-[panel-group-direction=vertical]:w-12" />
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
