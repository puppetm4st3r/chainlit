import type { PointerPoint } from './types';

/** Window-focus restore must not reopen a tooltip by itself. */
export const IGNORE_RESTORED_FOCUS_MS = 800;

/**
 * True when a focus event is the OS restoring focus after the window/tab
 * lost context, and the pointer is not already hovering the trigger.
 */
export function shouldIgnoreRestoredFocus(ignoreRestoredFocus: boolean, hovering: boolean): boolean {
  return ignoreRestoredFocus && !hovering;
}

/**
 * Hover / click already own the tooltip. Focus must not lock it open
 * (tree rows and icon buttons receive focus on pointerdown).
 */
export function shouldIgnoreFocusBecausePointer(hovering: boolean, pointerIntent: boolean): boolean {
  return hovering || pointerIntent;
}

/**
 * True when a document `mouseout` means the pointer left the page.
 */
export function isPageLeaveMouseOut(event: { relatedTarget: EventTarget | null; target: EventTarget | null }): boolean {
  if (event.relatedTarget !== null) {
    return false;
  }
  const target = event.target;
  return target === document
    || target === document.documentElement
    || target === document.body;
}

/**
 * Hit-test: event target, stacked element, or the trigger's viewport box.
 */
export function isPointerOverTrigger(
  trigger: Element,
  clientX: number,
  clientY: number,
  eventTarget: EventTarget | null,
): boolean {
  if (eventTarget instanceof Node && trigger.contains(eventTarget)) {
    return true;
  }

  const stacked = typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint(clientX, clientY)
    : null;
  if (stacked && (stacked === trigger || trigger.contains(stacked))) {
    return true;
  }

  const rect = trigger.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

/**
 * Store the last client point from a pointer / mouse event.
 */
export function pointerFromEvent(event: { clientX: number; clientY: number }): PointerPoint {
  return { x: event.clientX, y: event.clientY };
}
