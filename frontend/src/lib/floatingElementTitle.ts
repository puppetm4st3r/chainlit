import type { ICustomElement, IMessageElement } from '@chainlit/react-client';

/**
 * Prefer CustomElement props.title for floating chrome labels when present.
 * Element.name remains the ElementRef match token in message content.
 */
export function resolveFloatingElementTitle(element: IMessageElement): string {
  if (element.type === 'custom') {
    const props = (element as ICustomElement).props || {};
    const title = props.title;
    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
  }
  return element.name;
}
