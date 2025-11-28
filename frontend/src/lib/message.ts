import type { IMessageElement } from 'client-types/';

const toSafeLinkTarget = (name: string) =>
  encodeURIComponent(name.replace(/\s+/g, '_'))
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29'); // Encode parentheses to avoid issues in URLs

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
      } else {
        // Element is a reference, add it to the list and return link
        refElements.push(element);
        // Build a Markdown-safe link: escape text, and encode () in the slug
        // The address in the link is not used anyway
        return `[${match}](${toSafeLinkTarget(match)})`;
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
