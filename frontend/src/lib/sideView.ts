import type { IMessageElement } from '@chainlit/react-client';

/**
 * Builds a stable signature for a set of side view elements.
 *
 * The signature only depends on element identity (id + name), deliberately
 * ignoring prop or content changes. This makes the signature suitable for
 * dismissal tracking: once the user closes a side view, subsequent updates
 * to the same elements must not re-open it. Only the appearance or removal
 * of elements (change in the id set) will produce a new signature and allow
 * the side view to re-open automatically.
 */
export const buildSideViewElementsSignature = (
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
