import type { ICustomElement, IMessageElement } from 'client-types/';

import { shouldShowFloatingReopenChip } from '@/lib/floatingReopenChip';

const toSafeLinkTarget = (name: string) =>
  encodeURIComponent(name.replace(/\s+/g, '_'))
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29'); // Encode parentheses to avoid issues in URLs

/**
 * Build a stable markdown href that preserves the CustomElement match name
 * even when the visible link label is a human title (props.title).
 */
const toElementRefHref = (name: string) =>
  `#element:${encodeURIComponent(name)}`;

const isForIdMatch = (id: string | number | undefined, forId: string) => {
  if (!forId || !id) {
    return false;
  }

  return forId === id.toString();
};

const escapeRegExp = (string: string) => {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const escapeMarkdownLinkLabel = (label: string) =>
  String(label || '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');

/**
 * Prefer CustomElement props.title for the visible chip label.
 * Element.name remains the match token in message content / href.
 */
const resolveElementRefLabel = (element: IMessageElement, fallback: string) => {
  if (element.type === 'custom') {
    const props = (element as ICustomElement).props || {};
    const title = props.title;
    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
  }
  return fallback;
};

export const prepareContent = ({
  elements,
  content,
  id,
  language
}: {
  elements: IMessageElement[];
  content?: string;
  id: string;
  language?: string;
}) => {
  // Prepare content; no special token syntax, rely on simple name matches
  let preparedContent = content ? content.trim() : '';
  const refElements: IMessageElement[] = [];

  const elementNames = elements.map((e) => escapeRegExp(e.name));

  // Sort by descending length to avoid matching substrings
  elementNames.sort((a, b) => b.length - a.length);

  const elementRegexp = elementNames.length
    ? new RegExp(`(${elementNames.join('|')})`, 'g')
    : undefined;

  const inlinedElements = elements.filter(
    (e) => isForIdMatch(id, e?.forId) && e.display === 'inline'
  );
  // Keep collecting ref elements for non-inline references found later

  if (elementRegexp) {
    preparedContent = preparedContent.replaceAll(elementRegexp, (match) => {
      const element = elements.find((e) => {
        const nameMatch = e.name === match;
        const scopeMatch = isForIdMatch(id, e?.forId);
        return nameMatch && scopeMatch;
      });
      const foundElement = !!element;

      const inlined = element?.display === 'inline';
      if (!foundElement) {
        // Element reference does not exist, return plain text
        return match;
      } else if (inlined) {
        // Inline elements: special-case link to embed a direct anchor at the match position.
        if ((element as any).type === ('link' as any)) {
          if (!refElements.find((e) => e.id === element!.id)) {
            refElements.push(element);
          }
          const anyEl = element as any;
          const anchorKey = anyEl.chainlitKey || anyEl.id;
          const anchorText = element.name;
          return `[${anchorText}](#link:${anchorKey})`;
        }
        // For other inline elements, keep previous behavior (collect and leave text as-is)
        if (inlinedElements.indexOf(element) === -1) {
          inlinedElements.push(element);
        }
        return match;
      } else if (
        element.display === 'floating' &&
        element.type === 'custom' &&
        !shouldShowFloatingReopenChip(element)
      ) {
        // One-shot floating notices (e.g. Motd): strip the match token, no chip.
        return '';
      } else {
        // Element is a reference, add it to the list and return link.
        // Visible label may be props.title; href keeps the element name for lookup.
        refElements.push(element);
        const label = escapeMarkdownLinkLabel(
          resolveElementRefLabel(element, match)
        );
        if (element.display === 'floating' && element.type === 'custom') {
          return `[${label}](${toElementRefHref(element.name)})`;
        }
        return `[${label}](${toSafeLinkTarget(match)})`;
      }
    });
  }

  if (language && preparedContent) {
    const prefix = `\`\`\`${language}`;
    const suffix = '```';
    if (!preparedContent.startsWith('```')) {
      preparedContent = `${prefix}\n${preparedContent}\n${suffix}`;
    }
  }
  return {
    preparedContent,
    inlinedElements,
    refElements
  };
};
