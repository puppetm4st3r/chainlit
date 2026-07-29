import {
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';

type TextAtom = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  font?: string;
  color?: string;
  underline?: boolean;
  break?: 1;
};

type TableData = {
  headers: string[];
  rows: string[][];
};

type ExportBlock =
  | { type: 'table'; data: TableData }
  | { type: 'semantic'; element: Element }
  | { type: 'hr' }
  | { type: 'html'; element: HTMLElement };

const SELECTORS_TO_STRIP = [
  'button',
  '[role="button"]',
  '.element-link',
  '.chainlink',
  '.lucide',
  'svg'
].join(',');

/**
 * Clone a DOM node and strip interactive / chrome nodes before DOCX conversion.
 */
function sanitizeElement(element: Element | null): HTMLElement | null {
  if (!element) {
    return null;
  }
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(SELECTORS_TO_STRIP).forEach((node) => node.remove());
  clone.querySelectorAll('table').forEach((table) => table.remove());
  return clone;
}

function textAtomsFromNode(node: ChildNode): TextAtom[] {
  const text = node.textContent || '';
  if (!text.trim()) {
    return [];
  }
  return [{ text }];
}

function toTextRun(atom: TextAtom | TextRun): TextRun {
  if (atom instanceof TextRun) {
    return atom;
  }
  return new TextRun({
    text: atom.text,
    bold: atom.bold,
    italics: atom.italics,
    font: atom.font,
    color: atom.color,
    underline: atom.underline ? {} : undefined,
    break: atom.break
  });
}

function parseInlineElement(node: Element): Array<TextAtom | TextRun> {
  const tagName = node.tagName.toLowerCase();
  const children: Array<TextAtom | TextRun> = [];

  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      children.push(...textAtomsFromNode(child));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      children.push(...parseInlineElement(child as Element));
    }
  });

  if (tagName === 'strong' || tagName === 'b') {
    return children.map((obj) => {
      const text = obj instanceof TextRun ? '' : obj.text;
      if (obj instanceof TextRun) {
        return obj;
      }
      return new TextRun({ text, bold: true });
    });
  }
  if (tagName === 'em' || tagName === 'i') {
    return children.map((obj) => {
      if (obj instanceof TextRun) {
        return obj;
      }
      return new TextRun({ text: obj.text, italics: true });
    });
  }
  if (tagName === 'code') {
    return children.map((obj) => {
      if (obj instanceof TextRun) {
        return obj;
      }
      return new TextRun({ text: obj.text, font: 'Courier New' });
    });
  }
  if (tagName === 'a') {
    return children.map((obj) => {
      if (obj instanceof TextRun) {
        return obj;
      }
      return new TextRun({ text: obj.text, color: '0563C1', underline: {} });
    });
  }

  return children;
}

function headingParagraph(
  node: Element,
  size: number,
  spacing: { after: number; before: number }
): Paragraph {
  const atoms: Array<TextAtom | TextRun> = [];
  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      atoms.push(...textAtomsFromNode(child));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      atoms.push(...parseInlineElement(child as Element));
    }
  });
  const runs = atoms.map((obj) => {
    if (obj instanceof TextRun) {
      return obj;
    }
    return new TextRun({ text: obj.text, size, bold: true });
  });
  return new Paragraph({
    children: runs.length ? runs : [new TextRun(' ')],
    spacing
  });
}

function parseList(node: Element, level = 0): Paragraph[] {
  const listItems: Paragraph[] = [];
  node.querySelectorAll(':scope > li').forEach((li) => {
    const atoms: Array<TextAtom | TextRun> = [];
    let hasNestedList = false;

    Array.from(li.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if ((child.textContent || '').trim()) {
          atoms.push(...textAtomsFromNode(child));
        }
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const childEl = child as Element;
      const childTag = childEl.tagName.toLowerCase();
      if (childTag === 'ul' || childTag === 'ol') {
        hasNestedList = true;
      } else if (childTag === 'br') {
        atoms.push({ text: '', break: 1 });
      } else if (childTag === 'p') {
        Array.from(childEl.childNodes).forEach((pChild) => {
          if (pChild.nodeType === Node.TEXT_NODE) {
            atoms.push(...textAtomsFromNode(pChild));
          } else if (pChild.nodeType === Node.ELEMENT_NODE) {
            atoms.push(...parseInlineElement(pChild as Element));
          }
        });
      } else {
        atoms.push(...parseInlineElement(childEl));
      }
    });

    const runs = atoms.map(toTextRun);
    listItems.push(
      new Paragraph({
        children: runs.length ? runs : [new TextRun(' ')],
        spacing: { after: 60 },
        bullet: { level }
      })
    );

    if (hasNestedList) {
      li.querySelectorAll(':scope > ul, :scope > ol').forEach((nested) => {
        listItems.push(...parseList(nested, Math.min(level + 1, 8)));
      });
    }
  });
  return listItems;
}

function parseBlockElement(
  node: Element
): Paragraph | TextRun | Array<Paragraph | TextRun | TextAtom> | null {
  const tagName = node.tagName.toLowerCase();

  if (tagName === 'h1') {
    return headingParagraph(node, 32, { after: 240, before: 120 });
  }
  if (tagName === 'h2') {
    return headingParagraph(node, 28, { after: 200, before: 100 });
  }
  if (tagName === 'h3') {
    return headingParagraph(node, 24, { after: 180, before: 90 });
  }
  if (tagName === 'h4') {
    return headingParagraph(node, 20, { after: 160, before: 80 });
  }
  if (tagName === 'h5') {
    return headingParagraph(node, 18, { after: 140, before: 70 });
  }
  if (tagName === 'h6') {
    return headingParagraph(node, 16, { after: 120, before: 60 });
  }

  if (tagName === 'p') {
    const atoms: Array<TextAtom | TextRun> = [];
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        atoms.push(...textAtomsFromNode(child));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const inlineTag = (child as Element).tagName.toLowerCase();
        if (inlineTag === 'br') {
          atoms.push({ text: '', break: 1 });
        } else {
          atoms.push(...parseInlineElement(child as Element));
        }
      }
    });
    return new Paragraph({
      children: atoms.length ? atoms.map(toTextRun) : [new TextRun(' ')],
      spacing: { after: 120 }
    });
  }

  if (tagName === 'blockquote') {
    const atoms: Array<TextAtom | TextRun> = [];
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        atoms.push(...textAtomsFromNode(child));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        atoms.push(...parseInlineElement(child as Element));
      }
    });
    return new Paragraph({
      children: atoms.length ? atoms.map(toTextRun) : [new TextRun(' ')],
      indent: { left: 720 },
      border: {
        left: { size: 4, color: 'CCCCCC', style: BorderStyle.SINGLE }
      },
      spacing: { after: 120 }
    });
  }

  if (tagName === 'hr') {
    return new Paragraph({
      children: [new TextRun('')],
      border: {
        bottom: { size: 6, color: 'CCCCCC', style: BorderStyle.SINGLE }
      },
      spacing: { after: 200, before: 200 }
    });
  }

  if (tagName === 'ul' || tagName === 'ol') {
    return parseList(node);
  }

  if (tagName === 'li') {
    const atoms: Array<TextAtom | TextRun> = [];
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        atoms.push(...textAtomsFromNode(child));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        atoms.push(...parseInlineElement(child as Element));
      }
    });
    return new Paragraph({
      children: atoms.length ? atoms.map(toTextRun) : [new TextRun(' ')],
      spacing: { after: 60 }
    });
  }

  if (tagName === 'br') {
    return new Paragraph({
      children: [new TextRun({ text: '', break: 1 })],
      spacing: { after: 0 }
    });
  }

  if (tagName === 'div') {
    const children: Array<Paragraph | TextRun | TextAtom> = [];
    let hasBlockElements = false;
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if ((child.textContent || '').trim()) {
          children.push(...textAtomsFromNode(child));
        }
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const childEl = child as Element;
      const childTag = childEl.tagName.toLowerCase();
      if (
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'blockquote', 'hr', 'table'].includes(
          childTag
        )
      ) {
        hasBlockElements = true;
      }
      if (childTag === 'br') {
        children.push(new TextRun({ text: '', break: 1 }));
        return;
      }
      const parsed = parseBlockElement(childEl);
      if (!parsed) {
        return;
      }
      if (Array.isArray(parsed)) {
        children.push(...parsed);
      } else {
        children.push(parsed);
      }
    });

    if (!hasBlockElements && children.length) {
      const runs = children
        .filter((c): c is TextRun | TextAtom => !(c instanceof Paragraph))
        .map(toTextRun);
      if (runs.length) {
        return new Paragraph({ children: runs, spacing: { after: 120 } });
      }
    }
    return children.length ? children : null;
  }

  if (tagName === 'span') {
    const hasBoldClass =
      node.classList.contains('font-bold') ||
      node.classList.contains('font-semibold');
    const hasItalicClass =
      node.classList.contains('italic') ||
      node.classList.contains('font-italic');
    const atoms: Array<TextAtom | TextRun> = [];
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        atoms.push(...textAtomsFromNode(child));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        atoms.push(...parseInlineElement(child as Element));
      }
    });
    if (hasBoldClass || hasItalicClass) {
      return atoms.map((obj) => {
        if (obj instanceof TextRun) {
          return obj;
        }
        return new TextRun({
          text: obj.text,
          bold: hasBoldClass || undefined,
          italics: hasItalicClass || undefined
        });
      });
    }
    return atoms.length ? atoms : null;
  }

  return null;
}

function parseHtmlToDocxElements(element: HTMLElement): Array<Paragraph | Table> {
  const hasBlockElements = element.querySelector(
    'h1, h2, h3, h4, h5, h6, ul, ol, blockquote, hr, p'
  );
  const elements: Array<Paragraph | Table> = [];

  if (hasBlockElements) {
    Array.from(element.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const parsed = parseBlockElement(child as Element);
        if (!parsed) {
          return;
        }
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (item instanceof Paragraph) {
              elements.push(item);
            } else if (!(item instanceof TextRun) && 'text' in item) {
              elements.push(
                new Paragraph({
                  children: [toTextRun(item)],
                  spacing: { after: 120 }
                })
              );
            } else if (item instanceof TextRun) {
              elements.push(
                new Paragraph({
                  children: [item],
                  spacing: { after: 120 }
                })
              );
            }
          });
        } else if (parsed instanceof Paragraph) {
          elements.push(parsed);
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (text.trim()) {
          elements.push(
            new Paragraph({
              children: [new TextRun(text)],
              spacing: { after: 120 }
            })
          );
        }
      }
    });
    return elements;
  }

  let pending: Array<TextAtom | TextRun> = [];
  const flushPending = () => {
    if (!pending.length) {
      return;
    }
    elements.push(
      new Paragraph({
        children: pending.map(toTextRun),
        spacing: { after: 120 }
      })
    );
    pending = [];
  };

  Array.from(element.childNodes).forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text.trim()) {
        pending.push({ text });
      }
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const parsed = parseBlockElement(child as Element);
    if (!parsed) {
      return;
    }
    if (Array.isArray(parsed)) {
      const areInline = parsed.every(
        (p) => p instanceof TextRun || (!(p instanceof Paragraph) && 'text' in p)
      );
      if (areInline) {
        pending.push(
          ...(parsed as Array<TextAtom | TextRun>).filter(
            (p) => !(p instanceof Paragraph)
          )
        );
      } else {
        flushPending();
        parsed.forEach((item) => {
          if (item instanceof Paragraph) {
            elements.push(item);
          }
        });
      }
    } else if (parsed instanceof TextRun || (!(parsed instanceof Paragraph) && 'text' in parsed)) {
      pending.push(parsed as TextAtom | TextRun);
    } else if (parsed instanceof Paragraph) {
      flushPending();
      elements.push(parsed);
    }
  });
  flushPending();
  return elements;
}

function convertTableElement(tableEl: HTMLTableElement): TableData | null {
  const headers: string[] = [];
  tableEl.querySelectorAll('thead th, thead td').forEach((cell) => {
    headers.push(((cell as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim());
  });

  const rows: string[][] = [];
  tableEl.querySelectorAll('tbody tr').forEach((rowEl) => {
    const row: string[] = [];
    rowEl.querySelectorAll('th, td').forEach((cell) => {
      row.push(((cell as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim());
    });
    if (row.length) {
      rows.push(row);
    }
  });

  if (!headers.length && !rows.length) {
    return null;
  }
  return { headers, rows };
}

function extractBlocksFromStep(stepElement: Element): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  const orderedNodes = stepElement.querySelectorAll(
    'table, [role="article"], h1, h2, h3, h4, h5, h6, ul, ol, blockquote, [data-orientation="horizontal"]'
  );

  if (orderedNodes.length) {
    orderedNodes.forEach((node) => {
      const nodeTag = node.tagName.toLowerCase();
      if (nodeTag === 'table') {
        const tableData = convertTableElement(node as HTMLTableElement);
        if (tableData) {
          blocks.push({ type: 'table', data: tableData });
        }
      } else if (
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote'].includes(nodeTag)
      ) {
        blocks.push({ type: 'semantic', element: node });
      } else if (node.getAttribute('data-orientation') === 'horizontal') {
        blocks.push({ type: 'hr' });
      } else {
        const sanitized = sanitizeElement(node);
        if (sanitized) {
          blocks.push({ type: 'html', element: sanitized });
        }
      }
    });
    return blocks;
  }

  stepElement
    .querySelectorAll('.message-content, .prose, .markdown-body, .step-content')
    .forEach((block) => {
      const sanitized = sanitizeElement(block);
      if (sanitized) {
        blocks.push({ type: 'html', element: sanitized });
      }
    });
  return blocks;
}

function findPreviousStepElement(stepElement: Element): Element | null {
  let previous = stepElement.previousElementSibling;
  while (previous && !previous.classList.contains('step')) {
    previous = previous.previousElementSibling;
  }
  return previous;
}

/**
 * Collect consecutive assistant_message steps ending at the clicked message,
 * preserving prior multi-bubble export behavior from the legacy custom JS.
 */
function collectAssistantBlocks(
  stepElement: Element | null,
  fallbackElement: HTMLElement
): ExportBlock[] {
  const fallbackSanitized = sanitizeElement(fallbackElement);
  if (!stepElement) {
    return fallbackSanitized ? [{ type: 'html', element: fallbackSanitized }] : [];
  }

  const startStep = stepElement.classList.contains('step')
    ? stepElement
    : stepElement.closest('.step');
  if (!startStep || startStep.getAttribute('data-step-type') !== 'assistant_message') {
    return fallbackSanitized ? [{ type: 'html', element: fallbackSanitized }] : [];
  }

  const stepsToExport: Element[] = [startStep];
  let previousStep = findPreviousStepElement(startStep);
  while (
    previousStep &&
    previousStep.getAttribute('data-step-type') === 'assistant_message'
  ) {
    stepsToExport.push(previousStep);
    previousStep = findPreviousStepElement(previousStep);
  }
  stepsToExport.reverse();

  const blocks: ExportBlock[] = [];
  stepsToExport.forEach((step) => {
    blocks.push(...extractBlocksFromStep(step));
  });

  if (!blocks.length && fallbackSanitized) {
    blocks.push({ type: 'html', element: fallbackSanitized });
  }
  return blocks;
}

function normalizeRow(cells: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => (cells[i] || '').trim());
}

function createDocxTable(tableData: TableData): Table | null {
  const columnCount = Math.max(
    tableData.headers.length,
    ...tableData.rows.map((row) => row.length),
    0
  );
  if (!columnCount) {
    return null;
  }

  const totalWidth = 9000;
  const columnWidths = Array.from({ length: columnCount }, () =>
    Math.floor(totalWidth / columnCount)
  );
  const rows: TableRow[] = [];

  if (tableData.headers.length) {
    rows.push(
      new TableRow({
        tableHeader: true,
        children: normalizeRow(tableData.headers, columnCount).map(
          (text) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text, bold: true })],
                  spacing: { after: 60 }
                })
              ]
            })
        )
      })
    );
  }

  tableData.rows.forEach((row) => {
    rows.push(
      new TableRow({
        children: normalizeRow(row, columnCount).map(
          (text) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun(text || ' ')],
                  spacing: { after: 60 }
                })
              ]
            })
        )
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
    rows
  });
}

function buildDocChildren(blocks: ExportBlock[]): Array<Paragraph | Table> {
  const docChildren: Array<Paragraph | Table> = [];

  blocks.forEach((block, index) => {
    if (block.type === 'table') {
      const table = createDocxTable(block.data);
      if (!table) {
        return;
      }
      docChildren.push(table);
      if (index !== blocks.length - 1) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun(' ')],
            spacing: { after: 120 }
          })
        );
      }
      return;
    }

    if (block.type === 'semantic') {
      const parsed = parseBlockElement(block.element);
      if (!parsed) {
        return;
      }
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item instanceof Paragraph) {
            docChildren.push(item);
          }
        });
      } else if (parsed instanceof Paragraph) {
        docChildren.push(parsed);
      }
      return;
    }

    if (block.type === 'hr') {
      docChildren.push(
        new Paragraph({
          children: [new TextRun('')],
          border: {
            bottom: { size: 6, color: 'CCCCCC', style: BorderStyle.SINGLE }
          },
          spacing: { after: 200, before: 200 }
        })
      );
      return;
    }

    if (block.type === 'html') {
      docChildren.push(...parseHtmlToDocxElements(block.element));
    }
  });

  return docChildren;
}

/**
 * Build a DOCX blob from an assistant message DOM node (and consecutive prior
 * assistant bubbles), falling back to the rendered content element.
 */
export async function buildAssistantMessageDocxBlob(
  stepElement: Element | null,
  contentElement: HTMLElement
): Promise<Blob> {
  const blocks = collectAssistantBlocks(stepElement, contentElement);
  const children = buildDocChildren(blocks);
  if (!children.length) {
    throw new Error('No exportable content found for DOCX download');
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children
      }
    ]
  });
  return Packer.toBlob(doc);
}

/**
 * Trigger a browser download for the given DOCX blob.
 */
export function triggerDocxDownload(blob: Blob, filename?: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || `message_${Date.now()}.docx`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}
