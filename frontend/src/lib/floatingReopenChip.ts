import type { ICustomElement, IMessageElement } from '@chainlit/react-client';

/**
 * Whether a floating CustomElement should render a reopen chip in chat history.
 *
 * Backend requires an explicit bool on authoring; missing values are treated as
 * true only for historical elements loaded before the flag existed.
 */
export function shouldShowFloatingReopenChip(
  element: IMessageElement
): boolean {
  if (element.display !== 'floating' || element.type !== 'custom') {
    return false;
  }
  const flag = (element as ICustomElement).showReopenChip;
  return flag !== false;
}
