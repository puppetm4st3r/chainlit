import type { ICustomElement, IMessageElement } from '@chainlit/react-client';

/**
 * Returns true when the element is a CustomElement with display="floating".
 */
export const isFloatingCustom = (
  element: IMessageElement
): element is ICustomElement =>
  element.type === 'custom' && element.display === 'floating';

/**
 * Builds a stable signature for floating custom elements.
 *
 * The signature only depends on element identity (id + name), deliberately
 * ignoring prop or content changes. Once the user closes the floating window,
 * subsequent updates to the same elements must not re-open it. Only the
 * appearance or removal of elements (change in the id set) produces a new
 * signature and allows auto-open again.
 */
export const buildFloatingElementsSignature = (
  elements: IMessageElement[]
): string => {
  if (!elements || elements.length === 0) {
    return '';
  }

  const parts = elements
    .map((element) => {
      const id = element?.id ?? '';
      const name = element?.name ?? '';
      return `${id}::${name}`;
    })
    .filter((part) => part !== '::')
    .sort();

  return parts.join('|');
};

export type FloatingAutoOpenDecision =
  | { action: 'clear' }
  | { action: 'noop' }
  | { action: 'suppress' }
  | { action: 'open'; element: ICustomElement }
  | { action: 'sync'; element: ICustomElement };

/**
 * Pure decision for floating auto-open / sync / suppress.
 *
 * Identity changes (id set/order) drive open/suppress. Prop-only reference
 * updates sync the open window without reopening after dismiss.
 */
export const decideFloatingAutoOpen = ({
  candidates,
  previousIds,
  previousElementsById,
  dismissedSignature,
  currentOpenElementId
}: {
  candidates: ICustomElement[];
  previousIds: string[];
  previousElementsById: Map<string, IMessageElement>;
  dismissedSignature?: string;
  currentOpenElementId?: string;
}): FloatingAutoOpenDecision => {
  if (candidates.length === 0) {
    return { action: 'clear' };
  }

  const nextSignature = buildFloatingElementsSignature(candidates);
  const currentIds = candidates.map((e) => e.id);
  const identityChanged =
    currentIds.length !== previousIds.length ||
    currentIds.some((id, i) => previousIds[i] !== id);
  const refsChanged = candidates.some(
    (e) => previousElementsById.get(e.id) !== e
  );

  if (!identityChanged) {
    if (!refsChanged) {
      return { action: 'noop' };
    }
    if (currentOpenElementId) {
      const live = candidates.find((e) => e.id === currentOpenElementId);
      if (live) {
        return { action: 'sync', element: live };
      }
    }
    // Same id set after dismiss: keep suppressed; do not reopen on prop updates.
    return { action: 'noop' };
  }

  if (dismissedSignature && dismissedSignature === nextSignature) {
    return { action: 'suppress' };
  }

  return {
    action: 'open',
    element: candidates[candidates.length - 1]
  };
};
