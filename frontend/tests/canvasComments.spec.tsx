import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import React, { act } from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const anchorSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/comments/anchor.js'),
  'utf8'
);
const useCanvasCommentsSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/comments/useCanvasComments.js'),
  'utf8'
);
const prosemirrorDecorationsSource = readFileSync(
  resolve(
    __dirname,
    '../../../../backend/public/elements/canvas-editor/comments/prosemirrorDecorations.js'
  ),
  'utf8'
);

const createStubRect = () =>
  ({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
  }) as DOMRect;

const createPositionedRect = (top: number) =>
  ({
    left: 24,
    top,
    right: 144,
    bottom: top + 14,
    width: 120,
    height: 14,
  }) as DOMRect;

if (typeof Range !== 'undefined') {
  if (typeof Range.prototype.getClientRects !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [createStubRect()],
    });
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => createStubRect(),
    });
  }
}

function loadAnchorModule() {
  const transformedSource = anchorSource
    .replace('import { decodeVisibleSpaceRuns, encodeVisibleSpaceRuns } from "../whitespace.js";', '')
    .replace(/export function /g, 'function ');
  const executeModule = Function(
    'decodeVisibleSpaceRuns',
    'encodeVisibleSpaceRuns',
    `${transformedSource}
    return {
      buildTextAnchor,
      createCommentThread,
      createTextQuoteResolver,
      getLatestCommentEntry,
      mapRangeAcrossTextChange,
      normalizeCommentThreads,
      nowIso,
      resolveTextQuoteAnchor,
      updateThreadBody,
    };`
  );
  return executeModule(
    (value: unknown) => String(value ?? '').replace(/\u00a0/g, ' '),
    (value: unknown) =>
      String(value ?? '').replace(/(\S)( {2,})(?=\S)/g, (_match, prefix, spaces) => `${prefix}${'\u00a0'.repeat(spaces.length - 1)} `)
  ) as Record<string, unknown>;
}

function loadUseCanvasComments() {
  const anchorModule = loadAnchorModule();
  const { markdownToTrackedChangesText } = loadDiffModuleForComments();
  const getEditorView = (editorInstanceRef: React.MutableRefObject<unknown>) =>
    (editorInstanceRef.current as { wwEditor?: { view?: unknown } } | null)?.wwEditor?.view || null;
  const getEditorDocumentText = (editorInstanceRef: React.MutableRefObject<unknown>) => {
    const doc = (getEditorView(editorInstanceRef) as { state?: { doc?: { textBetween?: (...args: unknown[]) => string; content?: { size?: number }; nodeSize?: number } } } | null)?.state?.doc;
    if (!doc || typeof doc.textBetween !== 'function') {
      return '';
    }
    return String(doc.textBetween(0, doc.content?.size ?? doc.nodeSize ?? 0, '\n', '\n'));
  };
  const findEditorPositionForTextOffset = (
    doc: { textBetween?: (...args: unknown[]) => string; content?: { size?: number }; nodeSize?: number },
    targetOffset: number
  ) => {
    if (!doc || typeof doc.textBetween !== 'function') {
      return null;
    }
    const normalizedTarget = Math.max(0, Number(targetOffset) || 0);
    const maxPosition = Number(doc.content?.size ?? doc.nodeSize ?? 0);
    let left = 0;
    let right = maxPosition;
    let resolvedPosition = maxPosition;
    while (left <= right) {
      const midpoint = Math.floor((left + right) / 2);
      const textLength = String(doc.textBetween(0, midpoint, '\n', '\n')).length;
      if (textLength >= normalizedTarget) {
        resolvedPosition = midpoint;
        right = midpoint - 1;
      } else {
        left = midpoint + 1;
      }
    }
    return maxPosition > 0 ? Math.max(1, resolvedPosition) : resolvedPosition;
  };
  const getEditorPositionRangeForTextOffsets = (
    editorInstanceRef: React.MutableRefObject<unknown>,
    start: number,
    end: number
  ) => {
    const doc = (getEditorView(editorInstanceRef) as { state?: { doc?: { textBetween?: (...args: unknown[]) => string; content?: { size?: number }; nodeSize?: number } } } | null)?.state?.doc;
    if (!doc) {
      return null;
    }
    const from = findEditorPositionForTextOffset(doc, start);
    const to = findEditorPositionForTextOffset(doc, end);
    if (from === null || to === null || to <= from) {
      return null;
    }
    return { from, to };
  };
  const transformedSource = useCanvasCommentsSource
    .replace('import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";', '')
    .replace(/import \{[\s\S]*?\} from "\.\/anchor\.js";/, '')
    .replace(/import \{[\s\S]*?\} from "\.\.\/prosemirrorText\.js";/, '')
    .replace(/import \{[\s\S]*?\} from "\.\.\/ask\/message\.js";/, '')
    .replace(/import \{[\s\S]*?\} from "\.\.\/tracked-changes\/diff\.js";/, '')
    .replace('export function useCanvasComments', 'function useCanvasComments');
  const executeModule = Function(
    'useCallback',
    'useEffect',
    'useLayoutEffect',
    'useMemo',
    'useRef',
    'useState',
    'getEditorDocumentText',
    'getEditorPositionRangeForTextOffsets',
    'getEditorView',
    'buildCanvasResolveAiUserMessage',
    'markdownToTrackedChangesText',
    ...Object.keys(anchorModule),
    `${transformedSource}\nreturn { useCanvasComments };`
  );
  return (
    executeModule(
      React.useCallback,
      React.useEffect,
      React.useLayoutEffect,
      React.useMemo,
      React.useRef,
      React.useState,
      getEditorDocumentText,
      getEditorPositionRangeForTextOffsets,
      getEditorView,
      vi.fn(() => 'FileCommand:CanvasResolveAI\n{}'),
      markdownToTrackedChangesText,
      ...Object.values(anchorModule)
    ) as { useCanvasComments: (...args: unknown[]) => unknown }
  ).useCanvasComments;
}

function loadDiffModuleForComments() {
  const diffSource = readFileSync(
    resolve(
      __dirname,
      '../../../../backend/public/elements/canvas-editor/tracked-changes/diff.js'
    ),
    'utf8'
  );
  const transformedSource = diffSource
    .replace('import { decodeVisibleSpaceRuns } from "../whitespace.js";', '')
    .replace(/export function /g, 'function ');
  const executeModule = Function(
    'decodeVisibleSpaceRuns',
    `${transformedSource}
    return {
      markdownToTrackedChangesText,
    };`
  );
  return executeModule((value: unknown) => String(value ?? '').replace(/\u00a0/g, ' ')) as {
    markdownToTrackedChangesText: (value: string) => string;
  };
}

function loadProsemirrorDecorationsModule() {
  const transformedSource = prosemirrorDecorationsSource.replace(
    'export function createCanvasCommentDecorationController',
    'function createCanvasCommentDecorationController'
  );
  const executeModule = Function(
    `${transformedSource}\nreturn { createCanvasCommentDecorationController };`
  );
  return executeModule() as {
    createCanvasCommentDecorationController: () => Record<string, unknown>;
  };
}

const flushEffects = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const flushAnimationFrames = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await flushEffects();
};

function getEditableText(editorRoot: HTMLElement | null) {
  return String(editorRoot?.querySelector('[contenteditable="true"]')?.textContent || '');
}

function resolveTextPosition(editorRoot: HTMLElement | null, position: number) {
  const editableRoot = editorRoot?.querySelector('[contenteditable="true"]');
  if (!editableRoot) {
    return { node: document.createTextNode(''), offset: 0 };
  }
  const targetPosition = Math.max(0, Number(position) || 0);
  const walker = document.createTreeWalker(editableRoot, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let lastTextNode: Text | null = null;
  let currentNode = walker.nextNode() as Text | null;
  while (currentNode) {
    lastTextNode = currentNode;
    const textLength = currentNode.textContent?.length || 0;
    if (targetPosition <= currentOffset + textLength) {
      return {
        node: currentNode,
        offset: Math.max(0, Math.min(targetPosition - currentOffset, textLength)),
      };
    }
    currentOffset += textLength;
    currentNode = walker.nextNode() as Text | null;
  }
  return {
    node: lastTextNode || editableRoot,
    offset: lastTextNode ? lastTextNode.textContent?.length || 0 : editableRoot.childNodes.length,
  };
}

function createFakeEditorInstanceRef(editorRef: React.RefObject<HTMLDivElement>) {
  const doc = {
    get content() {
      return { size: getEditableText(editorRef.current).length };
    },
    get nodeSize() {
      return getEditableText(editorRef.current).length;
    },
    textBetween(from: number, to: number) {
      return getEditableText(editorRef.current).slice(Math.max(0, from), Math.max(0, to));
    },
  };
  return {
    current: {
      wwEditor: {
        view: {
          state: { doc },
          get dom() {
            return editorRef.current?.querySelector('[contenteditable="true"]') || null;
          },
          domAtPos(position: number) {
            return resolveTextPosition(editorRef.current, position);
          },
          coordsAtPos(position: number) {
            const top = Math.max(0, position) * 40;
            return {
              top,
              bottom: top + 18,
              left: 24,
              right: 144,
            };
          },
        },
      },
    },
  };
}

type HarnessProps = {
  useCanvasComments: ReturnType<typeof loadUseCanvasComments>;
  initialThreads: Record<string, unknown>[];
  selectionRangeRef: React.MutableRefObject<Range | null>;
  onState: (state: Record<string, unknown>) => void;
  sendCanvasSave: ReturnType<typeof vi.fn>;
  editorChildren?: React.ReactNode;
  content?: string;
};

function Harness({
  useCanvasComments,
  initialThreads,
  selectionRangeRef,
  onState,
  sendCanvasSave,
  editorChildren,
  content = '# Draft',
}: HarnessProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const editorInstanceRef = React.useMemo(() => createFakeEditorInstanceRef(editorRef), []);
  const canvasViewportRef = React.useRef<HTMLDivElement>(null);
  const [widgetConfig, setWidgetConfig] = React.useState({
    content,
    commentThreads: initialThreads,
  });
  const captureSelectionSnapshot = React.useCallback(() => {
    const range = selectionRangeRef.current;
    if (!(range instanceof Range) || range.collapsed) {
      return null;
    }
    const container = range.commonAncestorContainer;
    const containerEl =
      container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
    if (!editorRef.current || !containerEl || !editorRef.current.contains(containerEl)) {
      return null;
    }
    const fullText = String(
      editorRef.current.querySelector('[contenteditable="true"]')?.textContent || ''
    );
    const quote = String(range.toString() || '').trim();
    const textStart = fullText.indexOf(quote);
    if (!quote || textStart < 0) {
      return null;
    }
    const textEnd = textStart + quote.length;
    return {
      from: textStart,
      to: textEnd,
      visibleText: quote,
      canonicalText: quote,
      textStart,
      textEnd,
      rect: typeof range.getBoundingClientRect === 'function'
        ? range.getBoundingClientRect()
        : createStubRect(),
      rects: [],
      anchor: {
        quote,
        prefix: fullText.slice(Math.max(0, textStart - 24), textStart),
        suffix: fullText.slice(textEnd, textEnd + 24),
      },
      documentSignature: `${fullText.length}:test`,
      editorSelection: null,
    };
  }, [selectionRangeRef]);
  const state = useCanvasComments({
    editorRef,
    editorInstanceRef,
    editorMounted: true,
    canvasViewportRef,
    canvasSelection: {
      captureCurrentSelection: captureSelectionSnapshot,
      getLastSelectionSnapshot: captureSelectionSnapshot,
      clearSelectionSnapshot: vi.fn(),
      restoreSelection: vi.fn(),
    },
    layoutSignal: false,
    widgetConfig,
    setWidgetConfig,
    sendCanvasSave,
    getSafeCurrentContent: () => content,
    isReadonly: false,
  }) as Record<string, unknown>;

  React.useEffect(() => {
    onState(state);
  }, [onState, state]);

  return (
    <div ref={canvasViewportRef}>
      <div ref={editorRef}>
        <div className="toastui-editor-main">
          <div className="toastui-editor-contents">
            <div contentEditable suppressContentEditableWarning>
              {editorChildren ?? 'Hello world'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

describe('useCanvasComments', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves comment anchors across encoded and visible space representations', () => {
    const { resolveTextQuoteAnchor } = loadAnchorModule() as {
      resolveTextQuoteAnchor: (text: string, anchor: Record<string, string>) => unknown;
    };

    expect(
      resolveTextQuoteAnchor('foo  bar baz', {
        quote: 'foo\u00a0 bar',
        prefix: '',
        suffix: ' baz',
      })
    ).toEqual({ start: 0, end: 8 });
    expect(
      resolveTextQuoteAnchor('foo\u00a0 bar baz', {
        quote: 'foo  bar',
        prefix: '',
        suffix: ' baz',
      })
    ).toEqual({ start: 0, end: 8 });
  });

  it('mirrors backend apply-time matching for whitespace, curly quotes, and unique affixes', () => {
    const { resolveTextQuoteAnchor } = loadAnchorModule() as {
      resolveTextQuoteAnchor: (text: string, anchor: Record<string, string>) => unknown;
    };

    expect(
      resolveTextQuoteAnchor('facultará a EL ARRENDADOR a poner término inmediato', {
        quote: 'facultará\n\na EL ARRENDADOR a poner término inmediato',
        prefix: '',
        suffix: '',
      })
    ).toEqual({ start: 0, end: 51 });

    expect(
      resolveTextQuoteAnchor('Said \u201chello\u201d world', {
        quote: 'Said "hello" world',
        prefix: '',
        suffix: '',
      })
    ).toEqual({ start: 0, end: 18 });

    // Unique quote: wrong prefix must not detach the anchor.
    expect(
      resolveTextQuoteAnchor('alpha Hello world', {
        quote: 'Hello',
        prefix: 'WRONG ',
        suffix: '',
      })
    ).toEqual({ start: 6, end: 11 });

    // Ambiguous quote: affixes must select exactly one occurrence.
    expect(
      resolveTextQuoteAnchor('Hello world and Hello again', {
        quote: 'Hello',
        prefix: '',
        suffix: ' again',
      })
    ).toEqual({ start: 16, end: 21 });
    expect(
      resolveTextQuoteAnchor('Hello world and Hello again', {
        quote: 'Hello',
        prefix: 'WRONG ',
        suffix: ' again',
      })
    ).toBeNull();
  });

  it('filters and sorts visible threads using derived positions and activity', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[
          {
            commentThreadId: 'comment-thread-open',
            status: 'open',
            anchor: { quote: 'Hello', prefix: '', suffix: ' world' },
            comments: [
              {
                commentId: 'comment-open',
                body: 'Open comment',
                author: 'Dolf',
                initials: 'DF',
                createdAt: '2026-01-01T00:00:00+00:00',
                updatedAt: '2026-01-01T00:00:00+00:00',
                source: 'canvas',
              },
            ],
            docxCommentId: '',
          },
          {
            commentThreadId: 'comment-thread-resolved',
            status: 'resolved',
            anchor: { quote: 'world', prefix: 'Hello ', suffix: '' },
            comments: [
              {
                commentId: 'comment-resolved',
                body: 'Resolved comment',
                author: 'Dolf',
                initials: 'DF',
                createdAt: '2026-01-02T00:00:00+00:00',
                updatedAt: '2026-01-03T00:00:00+00:00',
                source: 'canvas',
              },
            ],
            docxCommentId: '',
          },
        ]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    expect((latestState.visibleThreads as Array<Record<string, unknown>>).map((thread) => thread.commentThreadId)).toEqual([
      'comment-thread-open',
    ]);

    await act(async () => {
      (latestState.setThreadFilter as (value: string) => void)('all');
      (latestState.setThreadSort as (value: string) => void)('recent-activity');
    });

    const updatedState = states.at(-1) as Record<string, unknown>;
    expect((updatedState.visibleThreads as Array<Record<string, unknown>>).map((thread) => thread.commentThreadId)).toEqual([
      'comment-thread-resolved',
      'comment-thread-open',
    ]);
  });

  it('hides resolved comment marks until the thread is selected', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[
          {
            commentThreadId: 'comment-thread-open',
            status: 'open',
            anchor: { quote: 'Hello', prefix: '', suffix: ' world' },
            comments: [],
            docxCommentId: '',
          },
          {
            commentThreadId: 'comment-thread-resolved',
            status: 'resolved',
            anchor: { quote: 'world', prefix: 'Hello ', suffix: '' },
            comments: [],
            docxCommentId: '',
          },
        ]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    expect(
      (latestState.commentDecorationRanges as Array<Record<string, unknown>>).map(
        (range) => range.commentThreadId
      )
    ).toEqual([
      'comment-thread-open',
    ]);

    await act(async () => {
      (latestState.setThreadFilter as (value: string) => void)('all');
      await flushEffects();
    });

    const filterState = states.at(-1) as Record<string, unknown>;

    await act(async () => {
      (filterState.setSelectedCommentThreadId as (commentThreadId: string) => void)('comment-thread-resolved');
      await flushEffects();
    });

    const selectedState = states.at(-1) as Record<string, unknown>;
    expect(
      (selectedState.commentDecorationRanges as Array<Record<string, unknown>>)
        .map((range) => range.commentThreadId)
        .sort()
    ).toEqual([
      'comment-thread-open',
      'comment-thread-resolved',
    ]);
  });

  it('rebases edited comment anchors before the next canvas save', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];
    const initialThreads = [
      {
        commentThreadId: 'comment-thread-edited',
        status: 'open',
        anchor: { quote: 'Hello', prefix: '', suffix: ' world' },
        comments: [],
        docxCommentId: '',
      },
    ];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    view.rerender(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren="HeXllo world"
      />
    );

    const latestState = states.at(-1) as Record<string, unknown>;
    let saveThreads: Array<Record<string, unknown>> = [];
    await act(async () => {
      saveThreads = (
        latestState.prepareCommentThreadsForSave as () => Array<Record<string, unknown>>
      )();
    });

    expect(saveThreads).toContainEqual(
      expect.objectContaining({
        commentThreadId: 'comment-thread-edited',
        anchor: expect.objectContaining({
          quote: 'HeXllo',
          suffix: ' world',
        }),
      })
    );
    expect(saveThreads[0]).not.toHaveProperty('position');
  });

  it('keeps expanding a fully replaced comment range while the user keeps typing', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];
    const initialThreads = [
      {
        commentThreadId: 'comment-thread-replaced',
        status: 'open',
        anchor: { quote: 'Hello', prefix: '', suffix: ' world' },
        comments: [],
        docxCommentId: '',
      },
    ];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    view.rerender(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren="A world"
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    view.rerender(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren="AB world"
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    const saveThreads = (
      latestState.prepareCommentThreadsForSave as () => Array<Record<string, unknown>>
    )();
    expect(saveThreads).toContainEqual(
      expect.objectContaining({
        commentThreadId: 'comment-thread-replaced',
        anchor: expect.objectContaining({
          quote: 'AB',
          suffix: ' world',
        }),
      })
    );
  });

  it('keeps replacement affinity when full-range deletion is emitted before insertion', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];
    const initialThreads = [
      {
        commentThreadId: 'comment-thread-delete-insert',
        status: 'open',
        anchor: { quote: 'Hello', prefix: '', suffix: ' world' },
        comments: [],
        docxCommentId: '',
      },
    ];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    view.rerender(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren=" world"
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    view.rerender(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren="A world"
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    view.rerender(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren="AB world"
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    const saveThreads = (
      latestState.prepareCommentThreadsForSave as () => Array<Record<string, unknown>>
    )();
    expect(saveThreads).toContainEqual(
      expect.objectContaining({
        commentThreadId: 'comment-thread-delete-insert',
        anchor: expect.objectContaining({
          quote: 'AB',
          suffix: ' world',
        }),
      })
    );
  });

  it('keeps workflow markdown anchors linked when editor text is WYSIWYG-shaped', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];
    const markdownContent =
      'Antes del ancla.\n\n- EL ARRENDADOR se obliga a pagar las contribuciones.\n\n' +
      'EL ARRENDADOR queda facultado para descontar deterioros en el\n\ninmueble arrendado.';
    const editorText =
      'Antes del ancla.\nEL ARRENDADOR se obliga a pagar las contribuciones.\n' +
      'EL ARRENDADOR queda facultado para descontar deterioros en el\ninmueble arrendado.';

    render(
      <Harness
        useCanvasComments={useCanvasComments}
        content={markdownContent}
        editorChildren={editorText}
        initialThreads={[
          {
            commentThreadId: 'comment-thread-list',
            status: 'open',
            anchor: {
              quote: '- EL ARRENDADOR se obliga a pagar las contribuciones.',
              prefix: 'Antes del ancla.\n\n',
              suffix: '\n\nEL ARRENDADOR queda',
            },
            comments: [
              {
                commentId: 'comment-list',
                body: 'Cláusulas abusivas\n\nLista markdown',
                author: 'Agente',
                createdAt: '2026-07-11T21:56:36.000Z',
                updatedAt: '2026-07-11T21:56:36.000Z',
                source: 'workflow',
              },
            ],
            docxCommentId: '',
          },
          {
            commentThreadId: 'comment-thread-paragraph',
            status: 'open',
            anchor: {
              quote:
                'EL ARRENDADOR queda facultado para descontar deterioros en el\n\ninmueble arrendado.',
              prefix: 'contribuciones.\n\n',
              suffix: '',
            },
            comments: [
              {
                commentId: 'comment-paragraph',
                body: 'Cláusulas abusivas\n\nSalto de párrafo',
                author: 'Agente',
                createdAt: '2026-07-11T21:56:36.000Z',
                updatedAt: '2026-07-11T21:56:36.000Z',
                source: 'workflow',
              },
            ],
            docxCommentId: '',
          },
        ]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    expect(latestState.detachedCommentThreadIds).toEqual([]);
  });

  it('keeps edited preserved-space comment ranges linked after anchor rebase', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];
    const initialThreads = [
      {
        commentThreadId: 'comment-thread-spaces',
        status: 'open',
        anchor: { quote: 'foo\u00a0 bar', prefix: '', suffix: ' baz' },
        comments: [],
        docxCommentId: '',
      },
    ];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren="foo  bar baz"
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    view.rerender(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={initialThreads}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren="foo  Xbar baz"
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    const saveThreads = (
      latestState.prepareCommentThreadsForSave as () => Array<Record<string, unknown>>
    )();
    expect(saveThreads).toContainEqual(
      expect.objectContaining({
        commentThreadId: 'comment-thread-spaces',
        anchor: expect.objectContaining({
          quote: 'foo\u00a0 Xbar',
          suffix: ' baz',
        }),
      })
    );
    expect(latestState.detachedCommentThreadIds).toEqual([]);
  });

  it('relinks a detached thread using the active text selection', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[
          {
            commentThreadId: 'comment-thread-detached',
            status: 'open',
            anchor: { quote: 'Missing', prefix: '', suffix: '' },
            comments: [
              {
                commentId: 'comment-detached',
                body: 'Detached comment',
                author: 'Dolf',
                initials: 'DF',
                createdAt: '2026-01-01T00:00:00+00:00',
                updatedAt: '2026-01-01T00:00:00+00:00',
                source: 'canvas',
              },
            ],
            docxCommentId: '',
          },
        ]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const editableRoot = view.container.querySelector('[contenteditable="true"]');
    const textNode = editableRoot?.firstChild;
    const range = document.createRange();
    range.setStart(textNode as Text, 0);
    range.setEnd(textNode as Text, 5);
    selectionRangeRef.current = range;

    const latestState = states.at(-1) as Record<string, unknown>;

    await act(async () => {
      (latestState.relinkThreadToSelection as (commentThreadId: string) => boolean)('comment-thread-detached');
    });

    expect(sendCanvasSave).toHaveBeenCalledTimes(1);
    expect(sendCanvasSave.mock.calls[0]?.[1]).toBe('widget_comment_relink');
    expect(sendCanvasSave.mock.calls[0]?.[3]).toMatchObject({
      commentThreads: [
        {
          commentThreadId: 'comment-thread-detached',
          anchor: {
            quote: 'Hello',
          },
        },
      ],
    });
  });

  it('deletes an existing comment thread from the sidecar', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[
          {
            commentThreadId: 'comment-thread-delete',
            status: 'open',
            anchor: { quote: 'Hello', prefix: '', suffix: ' world' },
            comments: [
              {
                commentId: 'comment-delete',
                body: 'Delete me',
                author: 'Dolf',
                initials: 'DF',
                createdAt: '2026-01-01T00:00:00+00:00',
                updatedAt: '2026-01-01T00:00:00+00:00',
                source: 'canvas',
              },
            ],
            docxCommentId: '',
          },
        ]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushEffects();
    });

    const latestState = states.at(-1) as Record<string, unknown>;

    await act(async () => {
      (latestState.deleteThread as (commentThreadId: string) => void)('comment-thread-delete');
    });

    expect(sendCanvasSave).toHaveBeenCalledTimes(1);
    expect(sendCanvasSave.mock.calls[0]?.[1]).toBe('widget_comment_delete');
    expect(sendCanvasSave.mock.calls[0]?.[3]).toMatchObject({
      commentThreads: [],
    });
  });

  it('opens the composer from an element-bounded selection range', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushEffects();
    });

    const editableRoot = view.container.querySelector('[contenteditable="true"]') as HTMLElement;
    const range = document.createRange();
    range.setStart(editableRoot, 0);
    range.setEnd(editableRoot, 1);
    selectionRangeRef.current = range;

    const latestState = states.at(-1) as Record<string, unknown>;

    await act(async () => {
      const opened = (latestState.openComposerFromSelection as () => boolean)();
      expect(opened).toBe(true);
    });

    const updatedState = states.at(-1) as Record<string, unknown>;
    expect(updatedState.composerState).toMatchObject({
      open: true,
      anchor: {
        quote: 'Hello world',
      },
    });
  });

  it('opens the composer from a selection that crosses markdown-styled nodes', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
        editorChildren={
          <>
            <span>Hello </span>
            <strong>styled</strong>
            <span> world</span>
          </>
        }
      />
    );

    await act(async () => {
      await flushEffects();
    });

    const styledElement = view.container.querySelector('strong') as HTMLElement;
    const styledNode = styledElement.firstChild as Text;
    const trailingNode = styledElement.nextElementSibling?.firstChild as Text;
    const range = document.createRange();
    range.setStart(styledNode, 0);
    range.setEnd(trailingNode, 6);
    selectionRangeRef.current = range;

    const latestState = states.at(-1) as Record<string, unknown>;

    await act(async () => {
      const opened = (latestState.openComposerFromSelection as () => boolean)();
      expect(opened).toBe(true);
    });

    const updatedState = states.at(-1) as Record<string, unknown>;
    expect(updatedState.composerState).toMatchObject({
      open: true,
      anchor: {
        quote: 'styled world',
      },
    });
  });

  it('disables comment creation when the selection overlaps an existing comment range', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[
          {
            commentThreadId: 'comment-thread-existing',
            status: 'open',
            anchor: {
              quote: 'Hello world',
              prefix: '',
              suffix: '',
            },
            comments: [
              {
                commentId: 'comment-existing',
                body: 'Existing comment',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                author: 'tester',
              },
            ],
          },
        ]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushEffects();
    });

    const editableRoot = view.container.querySelector('[contenteditable="true"]') as HTMLElement;
    const textNode = editableRoot.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);
    selectionRangeRef.current = range;

    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'));
      await flushAnimationFrames();
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    expect(latestState.hasSelectionAnchor).toBe(true);
    expect(latestState.hasSelectionCommentOverlap).toBe(true);
    expect(latestState.canCreateCommentFromSelection).toBe(false);

    await act(async () => {
      const opened = (latestState.openComposerFromSelection as () => boolean)();
      expect(opened).toBe(false);
    });

    const updatedState = states.at(-1) as Record<string, unknown>;
    expect(updatedState.composerState).toMatchObject({
      open: false,
    });
  });

  it('scrolls the editor viewport when selecting a comment thread', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[
          {
            commentThreadId: 'comment-thread-scroll',
            status: 'open',
            anchor: {
              quote: 'world',
              prefix: 'Hello ',
              suffix: '',
            },
            comments: [
              {
                commentId: 'comment-scroll',
                body: 'Scroll me',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                author: 'tester',
              },
            ],
          },
        ]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const scrollContainer = view.container.querySelector(
      '.toastui-editor-contents'
    ) as HTMLElement;
    const scrollTo = vi.fn();
    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 50,
    });
    Object.defineProperty(scrollContainer, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });
    vi.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
      ...createPositionedRect(0),
      top: 0,
      bottom: 200,
      height: 200,
    } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === scrollContainer) {
        return { overflowY: 'auto' } as CSSStyleDeclaration;
      }
      return { overflowY: 'visible' } as CSSStyleDeclaration;
    });

    const latestState = states.at(-1) as Record<string, unknown>;
    expect(latestState.detachedCommentThreadIds).toEqual([]);

    await act(async () => {
      (latestState.jumpToThread as (commentThreadId: string) => void)('comment-thread-scroll');
      await flushAnimationFrames();
    });

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({
        top: expect.any(Number),
        behavior: 'smooth',
      })
    );
    expect((states.at(-1) as Record<string, unknown>).selectedCommentThreadId).toBe(
      'comment-thread-scroll'
    );
  });

  it('keeps draft decorations stable without dispatching editor updates on scroll', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];
    let rectTop = 48;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      ...createPositionedRect(0),
      left: 0,
      top: 0,
      right: 640,
      bottom: 480,
      width: 640,
      height: 480,
    }));
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockImplementation(() =>
      createPositionedRect(rectTop)
    );
    vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(() =>
      [createPositionedRect(rectTop)] as unknown as DOMRectList
    );

    const view = render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    await act(async () => {
      await flushEffects();
    });

    const editableRoot = view.container.querySelector('[contenteditable="true"]') as HTMLElement;
    const textNode = editableRoot.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);
    selectionRangeRef.current = range;

    await act(async () => {
      const opened = ((states.at(-1) as Record<string, unknown>).openComposerFromSelection as () => boolean)();
      expect(opened).toBe(true);
    });
    await act(async () => {
      await flushAnimationFrames();
    });

    const initialState = states.at(-1) as Record<string, unknown>;
    expect(initialState.commentDecorationRanges).toContainEqual(
      expect.objectContaining({
        commentThreadId: '__draft__',
        from: 0,
        to: 5,
        active: true,
      })
    );
    expect(initialState.composerState).toMatchObject({
      top: 70,
    });

    rectTop = 18;
    await act(async () => {
      view.container.querySelector('.toastui-editor-contents')?.dispatchEvent(new Event('scroll'));
      await flushAnimationFrames();
    });

    const scrolledState = states.at(-1) as Record<string, unknown>;
    expect(scrolledState.commentDecorationRanges).toContainEqual(
      expect.objectContaining({
        commentThreadId: '__draft__',
        from: 0,
        to: 5,
        active: true,
      })
    );
    expect(scrolledState.composerState).toMatchObject({
      top: 70,
    });
  });

  it('rejects matching selections that come from outside the editor', async () => {
    const useCanvasComments = loadUseCanvasComments();
    const selectionRangeRef = { current: null } as React.MutableRefObject<Range | null>;
    const sendCanvasSave = vi.fn();
    const states: Record<string, unknown>[] = [];

    render(
      <Harness
        useCanvasComments={useCanvasComments}
        initialThreads={[]}
        selectionRangeRef={selectionRangeRef}
        onState={(state) => states.push(state)}
        sendCanvasSave={sendCanvasSave}
      />
    );

    const outsideNode = document.createElement('div');
    outsideNode.textContent = 'Hello world';
    document.body.appendChild(outsideNode);

    try {
      await act(async () => {
        await flushEffects();
      });

      const outsideTextNode = outsideNode.firstChild as Text;
      const range = document.createRange();
      range.setStart(outsideTextNode, 0);
      range.setEnd(outsideTextNode, outsideTextNode.textContent?.length || 0);
      selectionRangeRef.current = range;

      const latestState = states.at(-1) as Record<string, unknown>;

      await act(async () => {
        const opened = (latestState.openComposerFromSelection as () => boolean)();
        expect(opened).toBe(false);
      });
    } finally {
      outsideNode.remove();
    }
  });

  it('builds native ProseMirror decorations for visible comment ranges', () => {
    const { createCanvasCommentDecorationController } = loadProsemirrorDecorationsModule();
    const controller = createCanvasCommentDecorationController();
    const inline = vi.fn((from, to, attrs, spec) => ({ type: 'inline', from, to, attrs, spec }));
    const widget = vi.fn((position, render, spec) => ({ type: 'widget', position, render, spec }));
    const DecorationSet = {
      empty: { decorations: [] },
      create: vi.fn((_doc, decorations) => ({ decorations })),
    };
    class PluginKey {
      public getState(state: Record<string, unknown>) {
        return state.__commentDecorations;
      }
    }
    class Plugin {
      public spec: Record<string, unknown>;

      constructor(spec: Record<string, unknown>) {
        this.spec = spec;
      }
    }

    (controller.update as (payload: unknown) => void)({
      ranges: [
        { commentThreadId: 'comment-thread-open', from: 2, to: 7, active: true },
        { commentThreadId: 'comment-thread-invalid', from: 8, to: 8, active: false },
      ],
    });
    const pluginInfo = (controller.toastUiPlugin as (context: unknown) => Record<string, unknown>)({
      pmState: { Plugin, PluginKey },
      pmView: {
        Decoration: { inline, widget },
        DecorationSet,
      },
    });
    const [createPlugin] = pluginInfo.wysiwygPlugins as Array<() => Plugin>;
    const plugin = createPlugin();
    const decorationState = plugin.spec.state as {
      init: (config: unknown, state: unknown) => unknown;
    };
    const decorationSet = decorationState.init(
      {},
      { doc: { content: { size: 20 } } }
    ) as { decorations: Array<Record<string, unknown>> };

    expect(decorationSet.decorations).toHaveLength(3);
    expect(inline).toHaveBeenCalledTimes(3);
    expect(inline).toHaveBeenCalledWith(
      2,
      7,
      expect.objectContaining({
        class: expect.stringContaining('is-active'),
        'data-canvas-comment-id': 'comment-thread-open',
      }),
      expect.any(Object)
    );
    expect(inline).toHaveBeenCalledWith(
      2,
      3,
      expect.objectContaining({
        class: expect.stringContaining('canvas-comment-boundary-start'),
      }),
      expect.any(Object)
    );
    expect(inline).toHaveBeenCalledWith(
      6,
      7,
      expect.objectContaining({
        class: expect.stringContaining('canvas-comment-boundary-end'),
      }),
      expect.any(Object)
    );
    expect(widget).not.toHaveBeenCalled();
  });
});
