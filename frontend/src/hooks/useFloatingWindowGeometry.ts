import { useCallback, useEffect, useRef, useState } from 'react';

export type FloatingResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export type FloatingWindowBox = {
  width: number;
  height: number;
  left: number;
  top: number;
};

export type FloatingWindowGeometry = FloatingWindowBox & {
  maximized: boolean;
  /** Snapshot before maximize; used by Restore. Undefined when not maximized. */
  restore: FloatingWindowBox | undefined;
};

const MIN_WIDTH = 360;
const MIN_HEIGHT = 240;
const MAX_INSET = 16;
const MAXIMIZED_INSET = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Builds the default centered floating window box (80% × 70% of the viewport).
 */
export function buildDefaultFloatingGeometry(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
): FloatingWindowBox {
  const width = clamp(
    Math.round(0.8 * viewportWidth),
    MIN_WIDTH,
    Math.max(MIN_WIDTH, viewportWidth - MAX_INSET)
  );
  const height = clamp(
    Math.round(0.7 * viewportHeight),
    MIN_HEIGHT,
    Math.max(MIN_HEIGHT, viewportHeight - MAX_INSET)
  );
  return clampFloatingBox(
    {
      width,
      height,
      left: Math.round((viewportWidth - width) / 2),
      top: Math.round((viewportHeight - height) / 2)
    },
    viewportWidth,
    viewportHeight
  );
}

/**
 * Clamps a floating window box to the viewport and min/max size rules.
 */
export function clampFloatingBox(
  box: FloatingWindowBox,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
): FloatingWindowBox {
  const maxWidth = Math.max(MIN_WIDTH, viewportWidth - MAX_INSET);
  const maxHeight = Math.max(MIN_HEIGHT, viewportHeight - MAX_INSET);
  const width = clamp(box.width, MIN_WIDTH, maxWidth);
  const height = clamp(box.height, MIN_HEIGHT, maxHeight);
  return {
    width,
    height,
    left: clamp(box.left, 0, Math.max(0, viewportWidth - width)),
    top: clamp(box.top, 0, Math.max(0, viewportHeight - height))
  };
}

/**
 * Returns the maximized inset box for the current viewport.
 */
export function buildMaximizedFloatingBox(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
): FloatingWindowBox {
  return {
    left: MAXIMIZED_INSET,
    top: MAXIMIZED_INSET,
    width: Math.max(MIN_WIDTH, viewportWidth - MAXIMIZED_INSET * 2),
    height: Math.max(MIN_HEIGHT, viewportHeight - MAXIMIZED_INSET * 2)
  };
}

/**
 * Applies a resize delta for the given handle against a start box.
 */
export function applyFloatingResize(
  handle: FloatingResizeHandle,
  start: FloatingWindowBox,
  deltaX: number,
  deltaY: number,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
): FloatingWindowBox {
  let { width, height, left, top } = start;

  if (handle.includes('e')) {
    width = start.width + deltaX;
  }
  if (handle.includes('w')) {
    width = start.width - deltaX;
    left = start.left + deltaX;
  }
  if (handle.includes('s')) {
    height = start.height + deltaY;
  }
  if (handle.includes('n')) {
    height = start.height - deltaY;
    top = start.top + deltaY;
  }

  // Preserve the opposite edge when clamping west/north shrinks.
  if (handle.includes('w')) {
    const maxWidth = Math.max(MIN_WIDTH, viewportWidth - MAX_INSET);
    const clampedWidth = clamp(width, MIN_WIDTH, maxWidth);
    left = start.left + (start.width - clampedWidth);
    width = clampedWidth;
  }
  if (handle.includes('n')) {
    const maxHeight = Math.max(MIN_HEIGHT, viewportHeight - MAX_INSET);
    const clampedHeight = clamp(height, MIN_HEIGHT, maxHeight);
    top = start.top + (start.height - clampedHeight);
    height = clampedHeight;
  }

  return clampFloatingBox(
    { width, height, left, top },
    viewportWidth,
    viewportHeight
  );
}

type UseFloatingWindowGeometryOptions = {
  /** When false, geometry is discarded; next open uses defaults. */
  open: boolean;
  /**
   * Identity of the currently hosted element. Changing this while open
   * resets geometry to the default centered box.
   */
  resetKey?: string;
  /**
   * Whether the window opens maximized. Defaults to true for historical
   * floating elements that omit ``startMaximized``.
   */
  startMaximized?: boolean;
};

type UseFloatingWindowGeometryResult = {
  geometry: FloatingWindowGeometry;
  appliedBox: FloatingWindowBox;
  toggleMaximized: () => void;
  beginResize: (
    handle: FloatingResizeHandle,
    event: React.PointerEvent<HTMLElement>
  ) => void;
};

/**
 * Builds the initial floating geometry from the authored startMaximized flag.
 *
 * Maximized opens with an inset full viewport and a restore snapshot equal to
 * the default centered 80% × 70% window. Non-maximized opens at that default.
 */
export function buildInitialFloatingGeometry(
  startMaximized = true
): FloatingWindowGeometry {
  const restore = buildDefaultFloatingGeometry();
  if (startMaximized) {
    return {
      ...buildMaximizedFloatingBox(),
      maximized: true,
      restore
    };
  }
  return {
    ...restore,
    maximized: false,
    restore: undefined
  };
}

/**
 * Owns ephemeral floating-window size, maximize/restore, and pointer resize.
 */
export function useFloatingWindowGeometry({
  open,
  resetKey,
  startMaximized = true
}: UseFloatingWindowGeometryOptions): UseFloatingWindowGeometryResult {
  const [geometry, setGeometry] = useState<FloatingWindowGeometry>(() =>
    buildInitialFloatingGeometry(startMaximized)
  );

  const dragRef = useRef<{
    handle: FloatingResizeHandle;
    startX: number;
    startY: number;
    startBox: FloatingWindowBox;
  } | null>(null);

  useEffect(() => {
    setGeometry(buildInitialFloatingGeometry(startMaximized));
  }, [open, resetKey, startMaximized]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onViewportResize = () => {
      setGeometry((current) => {
        if (current.maximized) {
          return {
            ...current,
            ...buildMaximizedFloatingBox()
          };
        }
        return {
          ...current,
          ...clampFloatingBox(current)
        };
      });
    };

    window.addEventListener('resize', onViewportResize);
    return () => window.removeEventListener('resize', onViewportResize);
  }, [open]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const next = applyFloatingResize(
        drag.handle,
        drag.startBox,
        event.clientX - drag.startX,
        event.clientY - drag.startY
      );
      setGeometry((current) => {
        if (current.maximized) {
          return current;
        }
        return {
          ...current,
          ...next
        };
      });
    };

    const stopDragging = () => {
      if (!dragRef.current) {
        return;
      }
      dragRef.current = null;
      document.body.style.userSelect = '';
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', stopDragging);
    document.addEventListener('pointercancel', stopDragging);
    window.addEventListener('blur', stopDragging);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', stopDragging);
      document.removeEventListener('pointercancel', stopDragging);
      window.removeEventListener('blur', stopDragging);
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.userSelect = '';
      }
    };
  }, []);

  const toggleMaximized = useCallback(() => {
    setGeometry((current) => {
      if (current.maximized) {
        // Restore snapshot is always set when entering maximized mode.
        if (!current.restore) {
          throw new Error(
            'Floating window restore snapshot missing while maximized.'
          );
        }
        const restored = clampFloatingBox(current.restore);
        return {
          ...restored,
          maximized: false,
          restore: undefined
        };
      }
      const snapshot: FloatingWindowBox = {
        width: current.width,
        height: current.height,
        left: current.left,
        top: current.top
      };
      return {
        ...buildMaximizedFloatingBox(),
        maximized: true,
        restore: snapshot
      };
    });
  }, []);

  const beginResize = useCallback(
    (handle: FloatingResizeHandle, event: React.PointerEvent<HTMLElement>) => {
      if (geometry.maximized) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      document.body.style.userSelect = 'none';
      dragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startBox: {
          width: geometry.width,
          height: geometry.height,
          left: geometry.left,
          top: geometry.top
        }
      };
    },
    [geometry]
  );

  const appliedBox: FloatingWindowBox = geometry.maximized
    ? buildMaximizedFloatingBox()
    : {
        width: geometry.width,
        height: geometry.height,
        left: geometry.left,
        top: geometry.top
      };

  return {
    geometry,
    appliedBox,
    toggleMaximized,
    beginResize
  };
}
