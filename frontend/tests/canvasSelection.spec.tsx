import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const selectionSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/selection/useCanvasSelectionSnapshot.js'),
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

if (typeof Range !== 'undefined' && typeof Range.prototype.getClientRects !== 'function') {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [createStubRect()],
  });
}

function loadUseCanvasSelectionSnapshot() {
  const transformedSource = selectionSource
    .replace('import { useCallback, useRef } from "react";', '')
    .replace('export function useCanvasSelectionSnapshot', 'function useCanvasSelectionSnapshot');
  const executeModule = Function(
    'useCallback',
    'useRef',
    `${transformedSource}\nreturn { useCanvasSelectionSnapshot };`
  );
  return (
    executeModule(React.useCallback, React.useRef) as {
      useCanvasSelectionSnapshot: (...args: unknown[]) => unknown;
    }
  ).useCanvasSelectionSnapshot;
}

function createFakeDoc(text: string) {
  return {
    content: { size: text.length },
    textBetween: (from: number, to: number) => text.slice(from, to),
  };
}

function createFakeEditor(text: string, from: number, to: number) {
  const textNode = document.createTextNode(text);
  const editable = document.createElement('div');
  editable.appendChild(textNode);
  return {
    editor: {
      getSelection: () => [from, to],
      setSelection: vi.fn(),
      wwEditor: {
        view: {
          dom: editable,
          state: {
            doc: createFakeDoc(text),
            selection: { from, to },
          },
          domAtPos: (pos: number) => ({
            node: textNode,
            offset: Math.max(0, Math.min(text.length, pos)),
          }),
        },
      },
    },
  };
}

function Harness({
  text,
  from,
  to,
  onSnapshot,
}: {
  text: string;
  from: number;
  to: number;
  onSnapshot: (snapshot: Record<string, unknown> | null) => void;
}) {
  const useCanvasSelectionSnapshot = loadUseCanvasSelectionSnapshot();
  const editorInstanceRef = React.useRef(createFakeEditor(text, from, to).editor);
  const canvasViewportRef = React.useRef<HTMLDivElement>(null);
  const selection = useCanvasSelectionSnapshot({
    editorInstanceRef,
    canvasViewportRef,
    bridgeLinesToBackendCanonical: (value: string) => value,
    getSelectionRect: () => ({
      left: 10,
      top: 20,
      right: 60,
      bottom: 40,
      width: 50,
      height: 20,
    }),
    isReadonly: false,
    logCanvasNonFatalError: vi.fn(),
  }) as {
    captureCurrentSelection: () => Record<string, unknown> | null;
  };

  React.useEffect(() => {
    onSnapshot(selection.captureCurrentSelection());
  }, [onSnapshot, selection]);

  return <div ref={canvasViewportRef} />;
}

describe('useCanvasSelectionSnapshot', () => {
  it('captures ProseMirror text offsets for plain text selections', async () => {
    const snapshots: Array<Record<string, unknown> | null> = [];
    render(
      <Harness
        text="Hello plain world"
        from={6}
        to={11}
        onSnapshot={(snapshot) => snapshots.push(snapshot)}
      />
    );

    const snapshot = snapshots.at(-1) as Record<string, unknown>;
    expect(snapshot).toMatchObject({
      from: 6,
      to: 11,
      visibleText: 'plain',
      textStart: 6,
      textEnd: 11,
      anchor: {
        quote: 'plain',
        prefix: 'Hello ',
        suffix: ' world',
      },
    });
  });

  it('captures a single visible range across styled markdown text', async () => {
    const snapshots: Array<Record<string, unknown> | null> = [];
    render(
      <Harness
        text="Start strong and emphasized link code item"
        from={6}
        to={37}
        onSnapshot={(snapshot) => snapshots.push(snapshot)}
      />
    );

    const snapshot = snapshots.at(-1) as Record<string, unknown>;
    expect(snapshot.visibleText).toBe('strong and emphasized link code');
    expect(snapshot.anchor).toMatchObject({
      quote: 'strong and emphasized link code',
    });
    expect(snapshot.canonicalText).toBe('strong and emphasized link code');
  });

  it('rejects collapsed selections', async () => {
    const snapshots: Array<Record<string, unknown> | null> = [];
    render(
      <Harness
        text="No selection"
        from={3}
        to={3}
        onSnapshot={(snapshot) => snapshots.push(snapshot)}
      />
    );

    expect(snapshots.at(-1)).toBeNull();
  });
});
