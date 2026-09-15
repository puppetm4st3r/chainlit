const OVERFLOW_SLACK_PX = 1;

const IGNORE_OVERFLOW_SELECTOR = '[data-tooltip-overflow="ignore"]';

/**
 * Decorative tickers / marquees must not trigger overflow tooltips on a row.
 */
const DECORATIVE_OVERFLOW_SELECTOR = '[data-tooltip-marquee], [data-marquee], [data-ticker]';

const ANCESTOR_STOP_SELECTOR = 'body, html, [data-app-chrome], [role="dialog"]';

/**
 * True when computed styles describe an ellipsis or line-clamp truncation.
 */
export function isEllipsisCandidate(style: CSSStyleDeclaration): boolean {
  if (style.textOverflow === 'ellipsis') {
    return true;
  }

  const webkitClamp = style.getPropertyValue('-webkit-line-clamp').trim();
  const lineClamp = style.getPropertyValue('line-clamp').trim();
  if ((webkitClamp && webkitClamp !== 'none') || (lineClamp && lineClamp !== 'none')) {
    return true;
  }

  const whiteSpace = style.whiteSpace;
  const nowrap = whiteSpace === 'nowrap' || whiteSpace === 'pre';
  const hiddenX = style.overflowX === 'hidden' || style.overflow === 'hidden';
  return nowrap && hiddenX;
}

function isZeroBox(node: Element): boolean {
  return node instanceof HTMLElement && node.clientWidth === 0 && node.clientHeight === 0;
}

function isIgnoredOverflowNode(node: Element): boolean {
  return Boolean(node.closest(`${IGNORE_OVERFLOW_SELECTOR}, ${DECORATIVE_OVERFLOW_SELECTOR}`));
}

function elementHasEllipsisOverflow(node: Element): boolean {
  if (!(node instanceof HTMLElement) || isZeroBox(node) || isIgnoredOverflowNode(node)) {
    return false;
  }
  if (!isEllipsisCandidate(window.getComputedStyle(node))) {
    return false;
  }
  return node.scrollWidth > node.clientWidth + OVERFLOW_SLACK_PX
    || node.scrollHeight > node.clientHeight + OVERFLOW_SLACK_PX;
}

function shouldStopAncestorWalk(node: Element): boolean {
  return node === document.body
    || node === document.documentElement
    || node.matches(ANCESTOR_STOP_SELECTOR);
}

/**
 * Detect real ellipsis / line-clamp overflow on a trigger or a clipping ancestor.
 *
 * Decorative marquees and nodes marked `data-tooltip-overflow="ignore"` never
 * count. When the trigger itself does not overflow, ancestors are walked until
 * a dialog, app chrome, or the document root.
 */
export function triggerHasEllipsisOverflow(root: Element): boolean {
  if (elementHasEllipsisOverflow(root)) {
    return true;
  }

  const descendants = root.querySelectorAll('*');
  for (const node of descendants) {
    if (elementHasEllipsisOverflow(node)) {
      return true;
    }
  }

  let ancestor = root.parentElement;
  while (ancestor && !shouldStopAncestorWalk(ancestor)) {
    if (elementHasEllipsisOverflow(ancestor)) {
      return true;
    }
    ancestor = ancestor.parentElement;
  }

  return false;
}
