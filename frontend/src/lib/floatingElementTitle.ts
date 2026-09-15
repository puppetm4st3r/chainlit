import type { ICustomElement, IMessageElement } from '@chainlit/react-client';

/** CustomElement.name published by the Artifact workflow node. */
export const ARTIFACT_PREVIEW_ELEMENT_NAME = 'ArtifactPreview';

/**
 * True only for the Artifact preview reopen chip. Other floating
 * CustomElements (DynamicTable, Motd) keep their own chrome.
 */
export function isArtifactPreviewElement(element: IMessageElement): boolean {
  return element.name === ARTIFACT_PREVIEW_ELEMENT_NAME;
}

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
