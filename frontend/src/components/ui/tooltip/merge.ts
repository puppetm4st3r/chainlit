import {
  cloneElement,
  createElement,
  isValidElement,
  type DOMAttributes,
  type ReactElement,
  type Ref,
} from 'react';

type AnyProps = Record<string, unknown>;

/**
 * True when a React node is empty enough that no tooltip should mount.
 */
export function isEmptyTooltipLabel(label: unknown): boolean {
  if (label == null || label === false) {
    return true;
  }
  if (typeof label === 'string' && label.trim() === '') {
    return true;
  }
  return false;
}

/**
 * Assign a value to a callback or object ref.
 */
export function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) {
    return;
  }
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
}

/**
 * Merge the child's ref with the tooltip trigger ref.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    refs.forEach((ref) => assignRef(ref, node));
  };
}

function callHandler(original: unknown, event: unknown): void {
  if (typeof original === 'function') {
    original(event);
  }
}

/**
 * Clone the trigger, call its original handlers first, then ours.
 * Native `title` is always stripped so the browser tooltip cannot appear.
 */
export function mergeTooltipTrigger(
  child: ReactElement,
  triggerRef: Ref<Element>,
  handlers: DOMAttributes<Element>,
  describedBy?: string,
): ReactElement {
  if (!isValidElement(child)) {
    return child;
  }

  const childProps = child.props as AnyProps;
  const childRef = (child as { ref?: Ref<Element> }).ref ?? (childProps.ref as Ref<Element> | undefined);

  const merged: AnyProps = {
    title: undefined,
    ref: mergeRefs(childRef, triggerRef),
    onPointerEnter: (event: React.PointerEvent<Element>) => {
      callHandler(childProps.onPointerEnter, event);
      handlers.onPointerEnter?.(event);
    },
    onPointerLeave: (event: React.PointerEvent<Element>) => {
      callHandler(childProps.onPointerLeave, event);
      handlers.onPointerLeave?.(event);
    },
    onPointerDown: (event: React.PointerEvent<Element>) => {
      callHandler(childProps.onPointerDown, event);
      handlers.onPointerDown?.(event);
    },
    onPointerCancel: (event: React.PointerEvent<Element>) => {
      callHandler(childProps.onPointerCancel, event);
      handlers.onPointerCancel?.(event);
    },
    onMouseEnter: (event: React.MouseEvent<Element>) => {
      callHandler(childProps.onMouseEnter, event);
      handlers.onMouseEnter?.(event);
    },
    onMouseLeave: (event: React.MouseEvent<Element>) => {
      callHandler(childProps.onMouseLeave, event);
      handlers.onMouseLeave?.(event);
    },
    onMouseMove: (event: React.MouseEvent<Element>) => {
      callHandler(childProps.onMouseMove, event);
      handlers.onMouseMove?.(event);
    },
    onFocus: (event: React.FocusEvent<Element>) => {
      callHandler(childProps.onFocus, event);
      handlers.onFocus?.(event);
    },
    onBlur: (event: React.FocusEvent<Element>) => {
      callHandler(childProps.onBlur, event);
      handlers.onBlur?.(event);
    },
  };

  if (describedBy) {
    merged['aria-describedby'] = describedBy;
  }

  return cloneElement(child, merged);
}

/**
 * Remove the native HTML tooltip so only the official surface can appear.
 */
export function stripNativeTitle(child: ReactElement): ReactElement {
  if (!isValidElement(child)) {
    return child;
  }
  return cloneElement(child, { title: undefined } as AnyProps);
}

/**
 * Disabled controls do not receive hover. Wrap them in a focusable span
 * so the tooltip can still open (CTA blocked / icon-disabled pattern).
 */
export function wrapDisabledTrigger(child: ReactElement): ReactElement {
  const stripped = stripNativeTitle(child);
  const disabled = Boolean((stripped.props as { disabled?: boolean }).disabled);
  if (!disabled) {
    return stripped;
  }
  return createElement(
    'span',
    {
      className: 'ui-tooltip-disabled-wrap',
      tabIndex: 0,
      style: { display: 'inline-flex', maxWidth: '100%' },
    },
    stripped,
  );
}
