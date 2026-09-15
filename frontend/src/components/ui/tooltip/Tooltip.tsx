import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { placeTooltip, toViewportRect } from './geometry';
import { isEmptyTooltipLabel, mergeTooltipTrigger, wrapDisabledTrigger } from './merge';
import { triggerHasEllipsisOverflow } from './overflow';
import type { PointerPoint, TooltipAnchor, TooltipPlacement, TooltipProps } from './types';
import {
  IGNORE_RESTORED_FOCUS_MS,
  isPageLeaveMouseOut,
  isPointerOverTrigger,
  pointerFromEvent,
  shouldIgnoreFocusBecausePointer,
  shouldIgnoreRestoredFocus,
} from './visibility';

import './tooltip.css';

const DEFAULT_DELAY_MS = 200;
const UNMEASURED_STYLE: CSSProperties = { top: -9999, left: -9999 };

/**
 * Map MUI-style placements (`bottom-start`) onto the official four sides.
 */
export function normalizeTooltipPlacement(placement: string | undefined): TooltipPlacement {
  if (!placement) {
    return 'top';
  }
  if (placement.startsWith('bottom')) {
    return 'bottom';
  }
  if (placement.startsWith('left')) {
    return 'left';
  }
  if (placement.startsWith('right')) {
    return 'right';
  }
  return 'top';
}

function resolveLabel(label?: ReactNode, tooltip?: ReactNode, title?: ReactNode): ReactNode {
  if (!isEmptyTooltipLabel(tooltip)) {
    return tooltip;
  }
  if (!isEmptyTooltipLabel(label)) {
    return label;
  }
  return title;
}

function readPortalTarget(): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }
  return document.fullscreenElement ?? document.body;
}

/**
 * Official product tooltip. Portals to `document.body` (or the fullscreen
 * element), follows the pointer by default, and never covers the trigger or
 * the OS cursor glyph.
 */
export function Tooltip(props: TooltipProps & {
  arrow?: boolean;
  enterDelay?: number;
  leaveDelay?: number;
  describeChild?: boolean;
  disableHoverListener?: boolean;
  slotProps?: unknown;
  followCursor?: boolean;
}): ReactElement {
  const {
    children,
    delay = props.enterDelay ?? DEFAULT_DELAY_MS,
    flip = true,
    disabled = Boolean(props.disabled || props.disableHoverListener),
    whenOverflow = false,
    className,
  } = props;
  const label = resolveLabel(props.label, props.tooltip, props.title);
  const placement = normalizeTooltipPlacement(props.placement);
  const anchor: TooltipAnchor = props.followCursor === false ? 'trigger' : (props.anchor ?? 'cursor');

  const tooltipId = useId();
  const triggerRef = useRef<Element | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const hoveringRef = useRef(false);
  const focusedRef = useRef(false);
  const pointerArmedRef = useRef(false);
  const pointerIntentRef = useRef(false);
  const ignoreRestoredFocusRef = useRef(false);
  const pointerRef = useRef<PointerPoint | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const ignoreFocusTimerRef = useRef<number | null>(null);
  const openRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    visible: boolean;
    placement: TooltipPlacement;
    anchor: TooltipAnchor;
  }>({
    top: -9999,
    left: -9999,
    visible: false,
    placement,
    anchor,
  });
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const lastPlacementRef = useRef<TooltipPlacement>(placement);

  openRef.current = open;

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearShowTimer();
    hoveringRef.current = false;
    focusedRef.current = false;
    pointerArmedRef.current = false;
    openRef.current = false;
    lastPlacementRef.current = placement;
    setOpen(false);
    setCoords((current) => ({
      ...current,
      visible: false,
      top: -9999,
      left: -9999,
    }));
  }, [clearShowTimer]);

  const dismissLostContext = useCallback(() => {
    hide();
    ignoreRestoredFocusRef.current = true;
    if (ignoreFocusTimerRef.current !== null) {
      window.clearTimeout(ignoreFocusTimerRef.current);
    }
    ignoreFocusTimerRef.current = window.setTimeout(() => {
      ignoreRestoredFocusRef.current = false;
      ignoreFocusTimerRef.current = null;
    }, IGNORE_RESTORED_FOCUS_MS);
  }, [hide]);

  const canShow = useCallback((): boolean => {
    if (disabled || isEmptyTooltipLabel(label)) {
      return false;
    }
    if (!(hoveringRef.current || focusedRef.current)) {
      return false;
    }
    if (whenOverflow) {
      const trigger = triggerRef.current;
      if (!trigger || !triggerHasEllipsisOverflow(trigger)) {
        return false;
      }
    }
    return true;
  }, [disabled, label, whenOverflow]);

  const showNow = useCallback(() => {
    if (!canShow()) {
      return;
    }
    openRef.current = true;
    setOpen(true);
  }, [canShow]);

  const scheduleShow = useCallback((immediate: boolean) => {
    clearShowTimer();
    if (immediate || delay <= 0) {
      showNow();
      return;
    }
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      showNow();
    }, delay);
  }, [clearShowTimer, delay, showNow]);

  const armPointer = useCallback((event: { clientX: number; clientY: number }) => {
    hoveringRef.current = true;
    pointerArmedRef.current = true;
    pointerRef.current = pointerFromEvent(event);
    scheduleShow(false);
  }, [scheduleShow]);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const surface = surfaceRef.current;
    if (!trigger || !surface || !openRef.current) {
      return;
    }
    const measured = surface.getBoundingClientRect();
    const width = measured.width || surface.offsetWidth;
    const height = measured.height || surface.offsetHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }
    const next = placeTooltip({
      trigger: toViewportRect(trigger.getBoundingClientRect()),
      size: { width, height },
      pointer: anchor === 'cursor' ? pointerRef.current : null,
      preferred: placement,
      sticky: lastPlacementRef.current,
      anchor,
      flip,
      viewport: {
        width: window.innerWidth || document.documentElement.clientWidth || 1280,
        height: window.innerHeight || document.documentElement.clientHeight || 800,
      },
    });
    if (!Number.isFinite(next.box.top) || !Number.isFinite(next.box.left)) {
      return;
    }
    lastPlacementRef.current = next.placement;
    setCoords({
      top: next.box.top,
      left: next.box.left,
      visible: true,
      placement: next.placement,
      anchor: next.anchor,
    });
  }, [anchor, flip, placement]);

  useEffect(() => {
    const syncPortal = () => {
      setPortalTarget(readPortalTarget());
    };
    syncPortal();
    document.addEventListener('fullscreenchange', syncPortal);
    document.addEventListener('webkitfullscreenchange', syncPortal);
    return () => {
      document.removeEventListener('fullscreenchange', syncPortal);
      document.removeEventListener('webkitfullscreenchange', syncPortal);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    measure();
  }, [measure, open, label]);

  useEffect(() => {
    const onPointerMovePolice = (event: globalThis.PointerEvent) => {
      if (!hoveringRef.current && !openRef.current) {
        return;
      }
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      if (!isPointerOverTrigger(trigger, event.clientX, event.clientY, event.target)) {
        hide();
      }
    };

    const onDocumentPointerLeave = () => {
      hide();
    };

    const onDocumentMouseOut = (event: globalThis.MouseEvent) => {
      if (isPageLeaveMouseOut(event)) {
        hide();
      }
    };

    const onPointerDownOutside = (event: globalThis.PointerEvent) => {
      pointerIntentRef.current = true;
      const trigger = triggerRef.current;
      if (trigger && event.target instanceof Node && trigger.contains(event.target)) {
        return;
      }
      hide();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hide();
      }
    };

    const onScrollOrResize = () => {
      hide();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        dismissLostContext();
      }
    };

    const onWindowFocus = () => {
      const trigger = triggerRef.current;
      if (trigger instanceof Element && trigger.matches(':hover')) {
        hoveringRef.current = true;
        scheduleShow(false);
      }
    };

    document.addEventListener('pointermove', onPointerMovePolice, true);
    document.documentElement.addEventListener('pointerleave', onDocumentPointerLeave);
    document.addEventListener('mouseout', onDocumentMouseOut);
    document.addEventListener('pointerdown', onPointerDownOutside, true);
    document.addEventListener('pointercancel', dismissLostContext, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('blur', dismissLostContext);
    window.addEventListener('pagehide', dismissLostContext);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const onPointerUp = () => {
      window.setTimeout(() => {
        pointerIntentRef.current = false;
      }, 0);
    };

    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      document.removeEventListener('pointermove', onPointerMovePolice, true);
      document.documentElement.removeEventListener('pointerleave', onDocumentPointerLeave);
      document.removeEventListener('mouseout', onDocumentMouseOut);
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      document.removeEventListener('pointercancel', dismissLostContext, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('blur', dismissLostContext);
      window.removeEventListener('pagehide', dismissLostContext);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dismissLostContext, hide, scheduleShow]);

  useEffect(() => () => {
    clearShowTimer();
    if (ignoreFocusTimerRef.current !== null) {
      window.clearTimeout(ignoreFocusTimerRef.current);
    }
  }, [clearShowTimer]);

  if (disabled || isEmptyTooltipLabel(label)) {
    return mergeTooltipTrigger(wrapDisabledTrigger(children), triggerRef, {}, undefined);
  }

  const describedBy = open ? tooltipId : undefined;
  const trigger = mergeTooltipTrigger(
    wrapDisabledTrigger(children),
    triggerRef,
    {
      onPointerEnter: (event: PointerEvent<Element>) => {
        armPointer(event);
      },
      onPointerLeave: () => {
        hide();
      },
      onPointerDown: () => {
        pointerIntentRef.current = true;
      },
      onPointerCancel: () => {
        dismissLostContext();
      },
      onMouseEnter: (event: MouseEvent<Element>) => {
        armPointer(event);
      },
      onMouseLeave: () => {
        hide();
      },
      onMouseMove: (event: MouseEvent<Element>) => {
        pointerRef.current = pointerFromEvent(event);
        if (anchor === 'cursor' && openRef.current) {
          measure();
        }
      },
      onFocus: (event: FocusEvent<Element>) => {
        if (shouldIgnoreRestoredFocus(ignoreRestoredFocusRef.current, hoveringRef.current)) {
          return;
        }
        if (shouldIgnoreFocusBecausePointer(hoveringRef.current, pointerIntentRef.current)) {
          return;
        }
        if (whenOverflow) {
          const triggerNode = triggerRef.current ?? event.currentTarget;
          if (!triggerHasEllipsisOverflow(triggerNode)) {
            return;
          }
        }
        focusedRef.current = true;
        pointerRef.current = null;
        scheduleShow(true);
      },
      onBlur: () => {
        pointerIntentRef.current = false;
        focusedRef.current = false;
        if (!hoveringRef.current) {
          hide();
        }
      },
    },
    describedBy,
  );

  if (!portalTarget) {
    return trigger;
  }

  const surfaceClassName = className ? `ui-tooltip ${className}` : 'ui-tooltip';
  const surfaceStyle: CSSProperties = coords.visible
    ? { top: coords.top, left: coords.left }
    : UNMEASURED_STYLE;

  return (
    <>
      {trigger}
      {open && createPortal(
        <div
          ref={surfaceRef}
          id={tooltipId}
          role="tooltip"
          className={surfaceClassName}
          data-placement={coords.placement}
          data-anchor={coords.anchor}
          data-visible={coords.visible && open ? 'true' : 'false'}
          style={surfaceStyle}
        >
          {label}
        </div>,
        portalTarget,
      )}
    </>
  );
}

export { DEFAULT_DELAY_MS };
