import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFloatingWindowGeometry } from '@/hooks/useFloatingWindowGeometry';

describe('useFloatingWindowGeometry', () => {
  it('opens maximized by default and restores to the 80%x70% snapshot', () => {
    const { result, rerender } = renderHook(
      ({
        open,
        resetKey,
        startMaximized
      }: {
        open: boolean;
        resetKey?: string;
        startMaximized?: boolean;
      }) => useFloatingWindowGeometry({ open, resetKey, startMaximized }),
      { initialProps: { open: true, resetKey: 'a', startMaximized: true } }
    );

    expect(result.current.geometry.maximized).toBe(true);
    expect(result.current.appliedBox).toEqual({
      left: 8,
      top: 8,
      width: window.innerWidth - 16,
      height: window.innerHeight - 16
    });
    const restoreSnapshot = result.current.geometry.restore;
    expect(restoreSnapshot?.width).toBe(Math.round(0.8 * window.innerWidth));
    expect(restoreSnapshot?.height).toBe(Math.round(0.7 * window.innerHeight));

    act(() => {
      result.current.toggleMaximized();
    });
    expect(result.current.geometry.maximized).toBe(false);
    expect(result.current.geometry.restore).toBeUndefined();
    expect(result.current.appliedBox).toEqual(restoreSnapshot);

    act(() => {
      result.current.toggleMaximized();
    });
    expect(result.current.geometry.maximized).toBe(true);
    expect(result.current.geometry.restore).toEqual(restoreSnapshot);

    rerender({ open: false, resetKey: 'a', startMaximized: true });
    rerender({ open: true, resetKey: 'a', startMaximized: true });
    expect(result.current.geometry.maximized).toBe(true);
    expect(result.current.appliedBox.width).toBe(window.innerWidth - 16);
  });

  it('opens at the default centered size when startMaximized is false', () => {
    const { result } = renderHook(() =>
      useFloatingWindowGeometry({
        open: true,
        resetKey: 'windowed',
        startMaximized: false
      })
    );

    expect(result.current.geometry.maximized).toBe(false);
    expect(result.current.geometry.restore).toBeUndefined();
    expect(result.current.appliedBox.width).toBe(
      Math.round(0.8 * window.innerWidth)
    );
    expect(result.current.appliedBox.height).toBe(
      Math.round(0.7 * window.innerHeight)
    );
  });

  it('resets geometry when the hosted element id changes', () => {
    const { result, rerender } = renderHook(
      ({
        open,
        resetKey,
        startMaximized
      }: {
        open: boolean;
        resetKey?: string;
        startMaximized?: boolean;
      }) => useFloatingWindowGeometry({ open, resetKey, startMaximized }),
      { initialProps: { open: true, resetKey: 'one', startMaximized: true } }
    );

    act(() => {
      result.current.toggleMaximized();
    });
    expect(result.current.geometry.maximized).toBe(false);

    rerender({ open: true, resetKey: 'two', startMaximized: true });
    expect(result.current.geometry.maximized).toBe(true);
    expect(result.current.appliedBox.width).toBe(window.innerWidth - 16);
  });

  it('ignores resize while maximized', () => {
    const { result } = renderHook(() =>
      useFloatingWindowGeometry({
        open: true,
        resetKey: 'x',
        startMaximized: true
      })
    );

    expect(result.current.geometry.maximized).toBe(true);
    const maximizedBox = result.current.appliedBox;

    act(() => {
      const event = {
        preventDefault() {},
        stopPropagation() {},
        clientX: 10,
        clientY: 10
      } as unknown as React.PointerEvent<HTMLElement>;
      result.current.beginResize('se', event);
    });

    expect(result.current.appliedBox).toEqual(maximizedBox);
  });
});
