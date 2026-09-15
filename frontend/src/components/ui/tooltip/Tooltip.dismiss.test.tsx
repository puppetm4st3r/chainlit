/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tooltip } from './Tooltip';

function stubBoxes() {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element
  ) {
    if (this.getAttribute('role') === 'tooltip') {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 160,
        bottom: 36,
        width: 160,
        height: 36,
        toJSON: () => ({})
      } as DOMRect;
    }
    return {
      x: 10,
      y: 10,
      left: 10,
      top: 10,
      right: 90,
      bottom: 42,
      width: 80,
      height: 32,
      toJSON: () => ({})
    } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).getAttribute('role') === 'tooltip' ? 160 : 80;
    }
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return (this as HTMLElement).getAttribute('role') === 'tooltip' ? 36 : 32;
    }
  });
}

describe('Tooltip dismiss', () => {
  beforeEach(() => {
    stubBoxes();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens immediately at delay 0 and closes on leave, Escape, and window blur', () => {
    render(
      <Tooltip label="Help" delay={0}>
        <button type="button">Icon</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'Icon' });

    act(() => {
      fireEvent.pointerEnter(trigger, { clientX: 24, clientY: 24 });
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Help');
    expect(tooltip).toHaveAttribute('data-anchor', 'cursor');

    act(() => {
      fireEvent.pointerLeave(trigger);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();

    act(() => {
      fireEvent.pointerEnter(trigger, { clientX: 24, clientY: 24 });
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('tooltip')).toBeNull();

    act(() => {
      fireEvent.pointerEnter(trigger, { clientX: 24, clientY: 24 });
    });
    act(() => {
      fireEvent.blur(window);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not lock open after click + focus when the pointer already left', () => {
    render(
      <Tooltip label="Row name" delay={0}>
        <button type="button">Row</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'Row' });

    act(() => {
      fireEvent.pointerEnter(trigger, { clientX: 20, clientY: 20 });
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    act(() => {
      fireEvent.pointerDown(trigger);
      fireEvent.focus(trigger);
      fireEvent.pointerLeave(trigger);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
