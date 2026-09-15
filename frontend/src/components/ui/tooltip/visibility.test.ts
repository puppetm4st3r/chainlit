/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import {
  isPageLeaveMouseOut,
  shouldIgnoreFocusBecausePointer,
  shouldIgnoreRestoredFocus,
} from './visibility';

describe('tooltip visibility rules', () => {
  it('ignores restored window focus unless the pointer is already hovering', () => {
    expect(shouldIgnoreRestoredFocus(true, false)).toBe(true);
    expect(shouldIgnoreRestoredFocus(true, true)).toBe(false);
    expect(shouldIgnoreRestoredFocus(false, false)).toBe(false);
  });

  it('does not lock the tooltip to focus after hover or a click', () => {
    expect(shouldIgnoreFocusBecausePointer(true, false)).toBe(true);
    expect(shouldIgnoreFocusBecausePointer(false, true)).toBe(true);
    expect(shouldIgnoreFocusBecausePointer(false, false)).toBe(false);
  });

  it('detects a pointer leaving the page', () => {
    expect(isPageLeaveMouseOut({
      relatedTarget: null,
      target: document.body,
    })).toBe(true);
    expect(isPageLeaveMouseOut({
      relatedTarget: document.body,
      target: document.body,
    })).toBe(false);
  });
});
