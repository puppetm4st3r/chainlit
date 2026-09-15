import type { PointerPoint, TooltipAnchor, TooltipPlacement, ViewportRect } from './types';

/** Minimum gap between the tooltip and the viewport edge. */
export const VIEWPORT_MARGIN = 4;

/** Gap that must remain between the tooltip and the trigger / cursor glyph. */
export const TOOLTIP_GAP = 8;

/**
 * OS cursor exclusion in CSS pixels, measured from the hotspot.
 * The system pointer paints down-right of the hotspot; HTML cannot cover it.
 */
export const CURSOR_EXTENT = { left: 4, top: 4, right: 20, bottom: 28 } as const;

/**
 * Build a viewport rect from a measured `getBoundingClientRect` result.
 */
export function toViewportRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>): ViewportRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Exclusion box around the OS cursor hotspot.
 */
export function cursorBoxFromPointer(pointer: PointerPoint): ViewportRect {
  return {
    left: pointer.x - CURSOR_EXTENT.left,
    top: pointer.y - CURSOR_EXTENT.top,
    right: pointer.x + CURSOR_EXTENT.right,
    bottom: pointer.y + CURSOR_EXTENT.bottom,
    width: CURSOR_EXTENT.left + CURSOR_EXTENT.right,
    height: CURSOR_EXTENT.top + CURSOR_EXTENT.bottom,
  };
}

/**
 * True when two rects overlap, including an optional gap (treated as padding).
 */
export function rectsOverlap(a: ViewportRect, b: ViewportRect, gap = 0): boolean {
  return !(
    a.right + gap <= b.left
    || a.left - gap >= b.right
    || a.bottom + gap <= b.top
    || a.top - gap >= b.bottom
  );
}

/**
 * True when a viewport point falls inside a rect.
 */
export function pointInRect(point: PointerPoint, rect: ViewportRect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

/**
 * Expand a rect by the same amount on every side.
 */
export function inflateRect(rect: ViewportRect, gap: number): ViewportRect {
  return {
    left: rect.left - gap,
    top: rect.top - gap,
    right: rect.right + gap,
    bottom: rect.bottom + gap,
    width: rect.width + gap * 2,
    height: rect.height + gap * 2,
  };
}

/** Flip priority when the preferred side cannot be shown without covering. */
export const SIDE_PRIORITY: TooltipPlacement[] = ['top', 'right', 'bottom', 'left'];

/**
 * Preferred side first, then Top → Right → Bottom → Left.
 */
export function placementOrder(preferred: TooltipPlacement): TooltipPlacement[] {
  return [preferred, ...SIDE_PRIORITY.filter((side) => side !== preferred)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function boxFromOrigin(left: number, top: number, width: number, height: number): ViewportRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function clampBoxToViewport(box: ViewportRect, viewport: { width: number; height: number }): ViewportRect {
  const maxLeft = viewport.width - VIEWPORT_MARGIN - box.width;
  const maxTop = viewport.height - VIEWPORT_MARGIN - box.height;
  return boxFromOrigin(
    clamp(box.left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxLeft)),
    clamp(box.top, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxTop)),
    box.width,
    box.height,
  );
}

/**
 * Slide along the free axis (X on top/bottom, Y on left/right) so a wide or
 * tall tooltip can stay on the chosen side instead of flipping.
 */
function clampCrossAxis(
  box: ViewportRect,
  side: TooltipPlacement,
  viewport: { width: number; height: number },
): ViewportRect {
  if (side === 'top' || side === 'bottom') {
    const maxLeft = viewport.width - VIEWPORT_MARGIN - box.width;
    return boxFromOrigin(
      clamp(box.left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxLeft)),
      box.top,
      box.width,
      box.height,
    );
  }
  const maxTop = viewport.height - VIEWPORT_MARGIN - box.height;
  return boxFromOrigin(
    box.left,
    clamp(box.top, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxTop)),
    box.width,
    box.height,
  );
}

/**
 * True when the placement axis still fits. Cross-axis overflow is handled by sliding.
 */
function fitsPlacementAxis(
  box: ViewportRect,
  side: TooltipPlacement,
  viewport: { width: number; height: number },
): boolean {
  if (side === 'top' || side === 'bottom') {
    return box.top >= VIEWPORT_MARGIN && box.bottom <= viewport.height - VIEWPORT_MARGIN;
  }
  return box.left >= VIEWPORT_MARGIN && box.right <= viewport.width - VIEWPORT_MARGIN;
}

/**
 * Place the tooltip on one side of the trigger / cursor pair.
 *
 * Follows X on top/bottom and Y on left/right when a pointer is present.
 */
export function positionOnSide(
  side: TooltipPlacement,
  trigger: ViewportRect,
  size: { width: number; height: number },
  followX: number,
  followY: number,
  cursor: ViewportRect | null,
): ViewportRect {
  const { width, height } = size;
  switch (side) {
    case 'top':
      return boxFromOrigin(
        followX - width / 2,
        Math.min(cursor?.top ?? trigger.top, trigger.top) - height - TOOLTIP_GAP,
        width,
        height,
      );
    case 'bottom':
      return boxFromOrigin(
        followX - width / 2,
        Math.max(cursor?.bottom ?? trigger.bottom, trigger.bottom) + TOOLTIP_GAP,
        width,
        height,
      );
    case 'left':
      return boxFromOrigin(
        Math.min(cursor?.left ?? trigger.left, trigger.left) - width - TOOLTIP_GAP,
        followY - height / 2,
        width,
        height,
      );
    case 'right':
      return boxFromOrigin(
        Math.max(cursor?.right ?? trigger.right, trigger.right) + TOOLTIP_GAP,
        followY - height / 2,
        width,
        height,
      );
    default:
      return boxFromOrigin(followX - width / 2, trigger.top - height - TOOLTIP_GAP, width, height);
  }
}

export interface TrySideInput {
  side: TooltipPlacement;
  clamp: boolean;
  trigger: ViewportRect;
  size: { width: number; height: number };
  followX: number;
  followY: number;
  cursor: ViewportRect | null;
  pointer: PointerPoint | null;
  viewport: { width: number; height: number };
}

/**
 * Position one side and reject placements that clip, cover the trigger, cover
 * the OS cursor, or contain the pointer hotspot.
 */
export function trySide(input: TrySideInput): ViewportRect | null {
  let box = positionOnSide(input.side, input.trigger, input.size, input.followX, input.followY, input.cursor);
  box = clampCrossAxis(box, input.side, input.viewport);

  if (!input.clamp && !fitsPlacementAxis(box, input.side, input.viewport)) {
    return null;
  }

  if (input.clamp) {
    box = clampBoxToViewport(box, input.viewport);
  }

  if (rectsOverlap(box, inflateRect(input.trigger, TOOLTIP_GAP))) {
    return null;
  }
  if (input.cursor && rectsOverlap(box, inflateRect(input.cursor, TOOLTIP_GAP))) {
    return null;
  }
  if (input.pointer && pointInRect(input.pointer, box)) {
    return null;
  }
  return box;
}

export interface PlaceTooltipInput {
  trigger: ViewportRect;
  size: { width: number; height: number };
  pointer: PointerPoint | null;
  preferred: TooltipPlacement;
  /** Last side that was shown; kept only while preferred cannot fit. */
  sticky?: TooltipPlacement;
  anchor: TooltipAnchor;
  flip: boolean;
  viewport: { width: number; height: number };
}

export interface PlaceTooltipResult {
  box: ViewportRect;
  placement: TooltipPlacement;
  anchor: TooltipAnchor;
}

/**
 * Official placement: never cover the trigger or the OS cursor glyph.
 *
 * Tries the flip order without clamping, then with clamping, then falls back
 * to the preferred side even if it cannot be fully validated.
 */
export function placeTooltip(input: PlaceTooltipInput): PlaceTooltipResult {
  const useCursor = input.anchor === 'cursor' && input.pointer !== null;
  const cursor = useCursor && input.pointer ? cursorBoxFromPointer(input.pointer) : null;
  const followX = useCursor && input.pointer ? input.pointer.x : input.trigger.left + input.trigger.width / 2;
  const followY = useCursor && input.pointer ? input.pointer.y : input.trigger.top + input.trigger.height / 2;
  const resolvedAnchor: TooltipAnchor = useCursor ? 'cursor' : 'trigger';
  const baseOrder = placementOrder(input.preferred);
  const sticky = input.sticky;
  const order = sticky && sticky !== input.preferred && baseOrder.includes(sticky)
    ? [input.preferred, sticky, ...baseOrder.filter((side) => side !== input.preferred && side !== sticky)]
    : baseOrder;

  const attempt = (clamp: boolean): PlaceTooltipResult | null => {
    for (const side of order) {
      const box = trySide({
        side,
        clamp,
        trigger: input.trigger,
        size: input.size,
        followX,
        followY,
        cursor,
        pointer: useCursor ? input.pointer : null,
        viewport: input.viewport,
      });
      if (box) {
        return { box, placement: side, anchor: resolvedAnchor };
      }
    }
    return null;
  };

  const unclamped = attempt(false);
  if (unclamped) {
    return unclamped;
  }

  const clamped = attempt(true);
  if (clamped) {
    return clamped;
  }

  const fallbackSide = order[0] ?? input.preferred;
  return {
    box: positionOnSide(fallbackSide, input.trigger, input.size, followX, followY, cursor),
    placement: fallbackSide,
    anchor: resolvedAnchor,
  };
}
