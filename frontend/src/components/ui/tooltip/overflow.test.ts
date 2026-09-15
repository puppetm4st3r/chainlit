/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';

import { triggerHasEllipsisOverflow } from './overflow';

function textBox(options: {
  text: string;
  overflow: boolean;
  ellipsis?: boolean;
  nowrapHidden?: boolean;
  lineClamp?: boolean;
  marquee?: boolean;
  ignore?: boolean;
  tag?: string;
}): HTMLElement {
  const el = document.createElement(options.tag ?? 'div');
  el.textContent = options.text;
  if (options.ellipsis) {
    el.style.textOverflow = 'ellipsis';
    el.style.overflow = 'hidden';
    el.style.whiteSpace = 'nowrap';
  }
  if (options.nowrapHidden) {
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
  }
  if (options.lineClamp) {
    el.style.setProperty('-webkit-line-clamp', '2');
    el.style.overflow = 'hidden';
  }
  if (options.marquee) {
    el.setAttribute('data-ticker', 'true');
  }
  if (options.ignore) {
    el.setAttribute('data-tooltip-overflow', 'ignore');
  }
  Object.defineProperties(el, {
    clientWidth: { configurable: true, get: () => 80 },
    clientHeight: { configurable: true, get: () => 16 },
    scrollWidth: { configurable: true, get: () => (options.overflow ? 160 : 80) },
    scrollHeight: { configurable: true, get: () => 16 },
  });
  return el;
}

describe('triggerHasEllipsisOverflow', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('returns false when the text fits', () => {
    const el = textBox({ text: 'short', overflow: false, ellipsis: true });
    document.body.append(el);
    expect(triggerHasEllipsisOverflow(el)).toBe(false);
  });

  it('returns true when the trigger itself overflows', () => {
    const el = textBox({ text: 'very long label', overflow: true, ellipsis: true });
    document.body.append(el);
    expect(triggerHasEllipsisOverflow(el)).toBe(true);
  });

  it('returns true when a descendant is truncated', () => {
    const root = document.createElement('button');
    const child = textBox({ text: 'truncated child', overflow: true, ellipsis: true });
    root.append(child);
    document.body.append(root);
    expect(triggerHasEllipsisOverflow(root)).toBe(true);
  });

  it('returns true when a table cell clips at an ancestor', () => {
    const table = document.createElement('table');
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    const label = textBox({ text: 'clipped in cell', overflow: false, ellipsis: true });
    Object.defineProperties(cell, {
      clientWidth: { configurable: true, get: () => 64 },
      clientHeight: { configurable: true, get: () => 16 },
      scrollWidth: { configurable: true, get: () => 180 },
      scrollHeight: { configurable: true, get: () => 16 },
    });
    cell.style.textOverflow = 'ellipsis';
    cell.style.overflow = 'hidden';
    cell.style.whiteSpace = 'nowrap';
    cell.append(label);
    row.append(cell);
    table.append(row);
    document.body.append(table);
    expect(triggerHasEllipsisOverflow(label)).toBe(true);
  });

  it('ignores decorative marquee overflow', () => {
    const el = textBox({
      text: 'scrolling ticker',
      overflow: true,
      nowrapHidden: true,
      marquee: true,
    });
    document.body.append(el);
    expect(triggerHasEllipsisOverflow(el)).toBe(false);
  });
});
