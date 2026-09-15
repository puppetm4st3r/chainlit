import { describe, expect, it } from 'vitest';

import {
  CURSOR_EXTENT,
  TOOLTIP_GAP,
  cursorBoxFromPointer,
  placeTooltip,
  rectsOverlap,
} from './geometry';
import type { PointerPoint, ViewportRect } from './types';

const VIEWPORT = { width: 1280, height: 800 };

function rect(left: number, top: number, width: number, height: number): ViewportRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function place(input: {
  trigger: ViewportRect;
  size?: { width: number; height: number };
  pointer?: PointerPoint | null;
  preferred?: 'top' | 'bottom' | 'left' | 'right';
  flip?: boolean;
  anchor?: 'trigger' | 'cursor';
}) {
  return placeTooltip({
    trigger: input.trigger,
    size: input.size ?? { width: 160, height: 40 },
    pointer: input.pointer === undefined ? { x: input.trigger.left + 20, y: input.trigger.top + 16 } : input.pointer,
    preferred: input.preferred ?? 'top',
    anchor: input.anchor ?? 'cursor',
    flip: input.flip ?? true,
    viewport: VIEWPORT,
  });
}

describe('placeTooltip', () => {
  it('keeps preferred top when the pointer is inside a tall trigger', () => {
    const trigger = rect(400, 200, 80, 200);
    const pointer = { x: 440, y: 280 };
    const result = place({ trigger, pointer, preferred: 'top' });
    const cursor = cursorBoxFromPointer(pointer);

    expect(result.placement).toBe('top');
    expect(result.anchor).toBe('cursor');
    expect(rectsOverlap(result.box, trigger)).toBe(false);
    expect(rectsOverlap(result.box, cursor)).toBe(false);
    expect(result.box.bottom).toBeLessThanOrEqual(Math.min(cursor.top, trigger.top) - TOOLTIP_GAP + 0.01);
  });

  it('flips to right before bottom when there is no room above', () => {
    const trigger = rect(400, 8, 80, 40);
    const pointer = { x: 440, y: 28 };
    const result = place({ trigger, pointer, preferred: 'top' });
    const cursor = cursorBoxFromPointer(pointer);

    expect(result.placement).toBe('right');
    expect(result.box.left).toBeGreaterThanOrEqual(trigger.right);
    expect(result.box.left).toBeGreaterThanOrEqual(cursor.right + TOOLTIP_GAP);
    expect(rectsOverlap(result.box, trigger)).toBe(false);
  });

  it('flips to bottom when top and right cannot fit', () => {
    const trigger = rect(1100, 8, 80, 40);
    const pointer = { x: 1160, y: 28 };
    const result = place({
      trigger,
      pointer,
      preferred: 'top',
      size: { width: 200, height: 40 },
    });
    const cursor = cursorBoxFromPointer(pointer);

    expect(result.placement).toBe('bottom');
    expect(result.box.top).toBeGreaterThanOrEqual(trigger.bottom);
    expect(result.box.top).toBeGreaterThanOrEqual(cursor.bottom + TOOLTIP_GAP);
    expect(rectsOverlap(result.box, trigger)).toBe(false);
  });

  it('uses the right side when the trigger is almost viewport height', () => {
    const trigger = rect(100, 10, 80, 780);
    const pointer = { x: 140, y: 400 };
    const result = place({
      trigger,
      pointer,
      preferred: 'top',
      size: { width: 160, height: 40 },
    });
    const cursor = cursorBoxFromPointer(pointer);

    expect(result.placement).toBe('right');
    expect(result.box.left).toBeGreaterThanOrEqual(trigger.right);
    expect(result.box.left).toBeGreaterThanOrEqual(cursor.right + TOOLTIP_GAP);
  });

  it('places right of the cursor extent when the pointer is on the trigger right edge', () => {
    const trigger = rect(200, 300, 200, 40);
    const pointer = { x: trigger.right - 1, y: 320 };
    const result = place({
      trigger,
      pointer,
      preferred: 'right',
      size: { width: 160, height: 40 },
    });
    const cursor = cursorBoxFromPointer(pointer);

    expect(result.placement).toBe('right');
    expect(result.box.left).toBeGreaterThanOrEqual(trigger.right);
    expect(result.box.left).toBeGreaterThanOrEqual(cursor.right + TOOLTIP_GAP);
    expect(result.box.left).toBeGreaterThanOrEqual(pointer.x + CURSOR_EXTENT.right + TOOLTIP_GAP);
  });

  it('opens to the right of a top-stuck trigger on keyboard (no pointer)', () => {
    const trigger = rect(400, 4, 80, 32);
    const result = place({
      trigger,
      pointer: null,
      preferred: 'top',
      anchor: 'trigger',
    });

    expect(result.placement).toBe('right');
    expect(result.anchor).toBe('trigger');
    expect(rectsOverlap(result.box, trigger)).toBe(false);
  });

  it('keeps top and slides on X when a wide tooltip meets the viewport edge', () => {
    const trigger = rect(1100, 200, 80, 32);
    const pointer = { x: 1160, y: 216 };
    const result = place({
      trigger,
      pointer,
      preferred: 'top',
      size: { width: 320, height: 40 },
    });

    expect(result.placement).toBe('top');
    expect(result.box.right).toBeLessThanOrEqual(VIEWPORT.width - 4);
    expect(result.box.left).toBeGreaterThanOrEqual(4);
    expect(rectsOverlap(result.box, trigger)).toBe(false);
    expect(rectsOverlap(result.box, cursorBoxFromPointer(pointer))).toBe(false);
  });

  it('still flips to right when flip is false if top would cover or clip', () => {
    const trigger = rect(400, 4, 80, 32);
    const result = place({
      trigger,
      pointer: { x: 420, y: 20 },
      preferred: 'top',
      flip: false,
    });

    expect(result.placement).toBe('right');
    expect(rectsOverlap(result.box, trigger)).toBe(false);
  });
});
