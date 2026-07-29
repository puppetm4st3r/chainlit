import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useRecoilValue } from 'recoil';

import { floatingViewState, useChatData } from '@chainlit/react-client';

import { Element } from '@/components/Elements';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import { useDismissFloatingView } from '@/hooks/useDismissFloatingView';
import {
  FloatingResizeHandle,
  useFloatingWindowGeometry
} from '@/hooks/useFloatingWindowGeometry';
import { useTranslation } from 'components/i18n/Translator';

const RESIZE_HANDLES: Array<{
  handle: FloatingResizeHandle;
  className: string;
  cursor: string;
}> = [
  {
    handle: 'n',
    className: 'left-3 right-3 top-0 h-1.5',
    cursor: 'ns-resize'
  },
  {
    handle: 's',
    className: 'left-3 right-3 bottom-0 h-1.5',
    cursor: 'ns-resize'
  },
  {
    handle: 'e',
    className: 'top-3 bottom-3 right-0 w-1.5',
    cursor: 'ew-resize'
  },
  {
    handle: 'w',
    className: 'top-3 bottom-3 left-0 w-1.5',
    cursor: 'ew-resize'
  },
  {
    handle: 'ne',
    className: 'right-0 top-0 h-3 w-3',
    cursor: 'nesw-resize'
  },
  {
    handle: 'nw',
    className: 'left-0 top-0 h-3 w-3',
    cursor: 'nwse-resize'
  },
  {
    handle: 'se',
    className: 'right-0 bottom-0 h-3 w-3',
    cursor: 'nwse-resize'
  },
  {
    handle: 'sw',
    className: 'left-0 bottom-0 h-3 w-3',
    cursor: 'nesw-resize'
  }
];

const chromeButtonClassName = cn(
  'floating-chrome-button h-8 shrink-0 gap-1.5 px-2.5',
  'focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0',
  'focus:outline-none focus-visible:outline-none'
);

/**
 * Modal floating window host for CustomElements with display="floating".
 */
export default function ElementFloatingView() {
  const floatingView = useRecoilValue(floatingViewState);
  const dismissFloatingView = useDismissFloatingView();
  const { askUser } = useChatData();
  const { t } = useTranslation();
  const open = Boolean(floatingView);

  const { geometry, appliedBox, toggleMaximized, beginResize } =
    useFloatingWindowGeometry({
      open,
      resetKey: floatingView?.element.id,
      // Historical floating payloads omit the flag; they opened maximized.
      startMaximized: floatingView?.element.startMaximized !== false
    });

  if (!floatingView) {
    return null;
  }

  /**
   * Closing the floating chrome must also resolve a blocking AskElement when
   * the open floating CustomElement is the active ask target (e.g. Motd).
   */
  const dismissAndResolveAsk = () => {
    const element = floatingView.element;
    if (
      askUser?.spec.type === 'element' &&
      askUser.spec.step_id === element.forId
    ) {
      askUser.callback({ submitted: true, dismissed: 'close' });
    }
    dismissFloatingView(element);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      dismissAndResolveAsk();
    }
  };

  const maximizeLabel = geometry.maximized
    ? t('chat.floating.restore')
    : t('chat.floating.maximize');
  const closeLabel = t('chat.floating.close');

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogPortal container={window.cl_shadowRootElement}>
        <DialogOverlay />
        <DialogPrimitive.Content
          id="floating-view-content"
          data-testid="floating-view"
          aria-describedby={undefined}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden border bg-background shadow-lg sm:rounded-lg outline-none'
          )}
          style={{
            left: appliedBox.left,
            top: appliedBox.top,
            width: appliedBox.width,
            height: appliedBox.height
          }}
          onFocusOutside={(event) => {
            // Document workspace / ElementSidebar (canvas + comments) steals focus when
            // it mounts. That must never auto-dismiss an open floating DynamicTable.
            event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            const originalTarget =
              event.detail?.originalEvent?.target ?? event.target;
            // Keep intentional backdrop dismiss; block dismiss from side/canvas UI.
            if (
              !(originalTarget instanceof Element) ||
              !originalTarget.closest('[data-radix-dialog-overlay]')
            ) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            const originalTarget =
              event.detail?.originalEvent?.target ?? event.target;
            if (
              !(originalTarget instanceof Element) ||
              !originalTarget.closest('[data-radix-dialog-overlay]')
            ) {
              event.preventDefault();
            }
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-4 py-3"
            onDoubleClick={toggleMaximized}
          >
            <DialogTitle className="min-w-0 flex-1 truncate text-left">
              {floatingView.title}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-2">
              {/* Slot for CustomElement chrome actions (e.g. DynamicTable export). */}
              <div
                id="floating-view-actions"
                className="flex items-center gap-2"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={maximizeLabel}
                data-testid="floating-maximize-button"
                className={chromeButtonClassName}
                onClick={toggleMaximized}
              >
                {geometry.maximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
                <span>{maximizeLabel}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={closeLabel}
                data-testid="floating-close-button"
                className={chromeButtonClassName}
                onClick={dismissAndResolveAsk}
              >
                <X className="h-4 w-4" />
                <span>{closeLabel}</span>
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <Element element={floatingView.element} />
          </div>

          {!geometry.maximized
            ? RESIZE_HANDLES.map(({ handle, className, cursor }) => (
                <div
                  key={handle}
                  data-testid={`floating-resize-${handle}`}
                  className={cn('absolute z-10', className)}
                  style={{ cursor }}
                  onPointerDown={(event) => beginResize(handle, event)}
                />
              ))
            : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
