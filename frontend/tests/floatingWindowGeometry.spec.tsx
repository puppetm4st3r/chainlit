import { describe, expect, it } from 'vitest';

import {
  applyFloatingResize,
  buildDefaultFloatingGeometry,
  buildMaximizedFloatingBox,
  clampFloatingBox
} from '@/hooks/useFloatingWindowGeometry';

describe('floating window geometry', () => {
  it('defaults to 80% width and 70% height, centered', () => {
    const box = buildDefaultFloatingGeometry(1000, 800);
    expect(box.width).toBe(800);
    expect(box.height).toBe(560);
    expect(box.left).toBe(100);
    expect(box.top).toBe(120);
  });

  it('clamps default size on tiny viewports', () => {
    const box = buildDefaultFloatingGeometry(300, 200);
    expect(box.width).toBeGreaterThanOrEqual(360);
    expect(box.height).toBeGreaterThanOrEqual(240);
  });

  it('builds maximized inset box', () => {
    expect(buildMaximizedFloatingBox(1000, 800)).toEqual({
      left: 8,
      top: 8,
      width: 984,
      height: 784
    });
  });

  it('south-east resize increases width and height then clamps', () => {
    const start = { width: 400, height: 300, left: 10, top: 10 };
    const next = applyFloatingResize('se', start, 50, 40, 1000, 800);
    expect(next.width).toBe(450);
    expect(next.height).toBe(340);
    expect(next.left).toBe(10);
    expect(next.top).toBe(10);

    const clamped = applyFloatingResize('se', start, 5000, 5000, 1000, 800);
    expect(clamped.width).toBe(984);
    expect(clamped.height).toBe(784);
  });

  it('west resize shrinks width and moves left without going below min', () => {
    const start = { width: 500, height: 300, left: 100, top: 20 };
    const next = applyFloatingResize('w', start, 50, 0, 1000, 800);
    expect(next.width).toBe(450);
    expect(next.left).toBe(150);

    const minned = applyFloatingResize('w', start, 400, 0, 1000, 800);
    expect(minned.width).toBe(360);
    expect(minned.left).toBe(240);
  });

  it('clampFloatingBox keeps the box inside the viewport', () => {
    const clamped = clampFloatingBox(
      { width: 2000, height: 2000, left: -10, top: -20 },
      1000,
      800
    );
    expect(clamped.width).toBe(984);
    expect(clamped.height).toBe(784);
    expect(clamped.left).toBe(0);
    expect(clamped.top).toBe(0);
  });
});
