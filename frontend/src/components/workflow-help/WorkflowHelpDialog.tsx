import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useTranslation } from 'components/i18n/Translator';

import { useWorkflowHelpController } from '@/hooks/useWorkflowHelpController';

const AUTO_OPEN_COUNTDOWN_MS = 7000;

const resolveHelpUrl = (url: string): string => {
  if (typeof window === 'undefined') {
    return url;
  }

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
};

export default function WorkflowHelpDialog() {
  const {
    activeHelp,
    closeAndPersistPreferences,
    isOpen,
    isPersistentlyDismissed,
    openReason
  } = useWorkflowHelpController();
  const { t } = useTranslation();
  const [suppressAutoOpen, setSuppressAutoOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [requiresScroll, setRequiresScroll] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const resolvedHelpUrl = useMemo(
    () => resolveHelpUrl(activeHelp?.url || ''),
    [activeHelp?.url]
  );

  useEffect(() => {
    setSuppressAutoOpen(isPersistentlyDismissed);
  }, [activeHelp?.preferenceKey, isPersistentlyDismissed]);

  useEffect(() => {
    setIframeLoading(true);
  }, [resolvedHelpUrl, isOpen]);

  useEffect(() => {
    if (!isOpen || openReason !== 'auto') {
      setRequiresScroll(false);
      setHasScrolledToBottom(false);
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      setRequiresScroll(false);
      setHasScrolledToBottom(true);
      return;
    }

    const nextRequiresScroll =
      container.scrollHeight - container.clientHeight > 24;
    setRequiresScroll(nextRequiresScroll);
    setHasScrolledToBottom(!nextRequiresScroll);
  }, [iframeLoading, isOpen, openReason, resolvedHelpUrl]);

  useEffect(() => {
    if (!isOpen || openReason !== 'auto') {
      setRemainingSeconds(0);
      return;
    }

    let animationFrameId = 0;
    const countdownStart = performance.now();

    const tick = (now: number) => {
      const elapsedMs = now - countdownStart;
      const remainingMs = Math.max(0, AUTO_OPEN_COUNTDOWN_MS - elapsedMs);
      const nextRemainingSeconds = Math.ceil(remainingMs / 1000);

      setRemainingSeconds((previousValue) =>
        previousValue === nextRemainingSeconds
          ? previousValue
          : nextRemainingSeconds
      );

      if (remainingMs > 0) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    setRemainingSeconds(Math.ceil(AUTO_OPEN_COUNTDOWN_MS / 1000));
    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isOpen, openReason]);

  if (!activeHelp) {
    return null;
  }

  const isCountdownLocked = openReason === 'auto' && remainingSeconds > 0;
  const isScrollLocked =
    openReason === 'auto' && requiresScroll && !hasScrolledToBottom;
  const isAutoLocked = isCountdownLocked || isScrollLocked;
  const primaryButtonLabel = isCountdownLocked
    ? t('workflowHelp.continueCountdown', { count: remainingSeconds })
    : isScrollLocked
      ? t('workflowHelp.scrollToContinue')
      : openReason === 'manual'
        ? t('workflowHelp.close')
        : t('common.actions.continue');

  const handleClose = () => {
    closeAndPersistPreferences({
      suppressAutoOpen,
      acknowledgeAutoOpen: openReason === 'auto'
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          return;
        }
        if (isAutoLocked) {
          return;
        }
        handleClose();
      }}
    >
      <DialogContent
        className={[
          'flex h-[92vh] w-[96vw] max-w-[1400px] flex-col gap-4 overflow-hidden p-0',
          isAutoLocked ? '[&>button]:hidden' : ''
        ].join(' ')}
        onEscapeKeyDown={(event) => {
          if (isAutoLocked) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isAutoLocked) {
            event.preventDefault();
          }
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <DialogTitle>
                  {activeHelp.title || t('workflowHelp.titleFallback')}
                </DialogTitle>
                <DialogDescription>
                  {t('workflowHelp.embedHint')}
                </DialogDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <a
                  href={resolvedHelpUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="!size-4" />
                  {t('workflowHelp.openInNewTab')}
                </a>
              </Button>
            </div>
          </DialogHeader>

          <div
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4"
            onScroll={(event) => {
              if (openReason !== 'auto' || !requiresScroll) {
                return;
              }
              const target = event.currentTarget;
              const reachedBottom =
                target.scrollTop + target.clientHeight >=
                target.scrollHeight - 24;
              if (reachedBottom) {
                setHasScrolledToBottom(true);
              }
            }}
            ref={scrollContainerRef}
          >
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/20">
              {iframeLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  {t('common.status.loading')}
                </div>
              ) : null}
              <iframe
                className="h-[900px] min-h-[900px] w-full bg-background"
                src={resolvedHelpUrl}
                title={activeHelp.title || t('workflowHelp.titleFallback')}
                onLoad={() => setIframeLoading(false)}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {t('workflowHelp.fallbackNotice')}
            </p>

            {openReason === 'auto' ? (
              <p className="text-sm font-medium text-foreground">
                {t('workflowHelp.scrollRequirement')}
              </p>
            ) : null}

            <label className="flex items-center gap-3 text-sm text-foreground">
              <Checkbox
                checked={suppressAutoOpen}
                id="workflow-help-suppress-auto-open"
                onCheckedChange={(checked) =>
                  setSuppressAutoOpen(Boolean(checked))
                }
              />
              <span>{t('workflowHelp.doNotShowAutomatically')}</span>
            </label>
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button disabled={isAutoLocked} onClick={handleClose}>
              {primaryButtonLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
