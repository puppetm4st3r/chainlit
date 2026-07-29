import { describe, expect, it } from 'vitest';

import type { IMessageElement } from '@chainlit/react-client';

import {
  excludeCanvasShellElements,
  isCanvasShellElement
} from '../src/lib/canvas';

const canvasShell = (id: string, widgetInstanceId: string): IMessageElement =>
  ({
    id,
    type: 'custom',
    name: 'Canvas Editor',
    display: 'side',
    props: {
      workspaceKey: '{"owner":"document_workspace"}',
      widgetInstanceId
    }
  }) as IMessageElement;

const pdfSide = (id: string): IMessageElement =>
  ({
    id,
    type: 'pdf',
    name: 'doc.pdf',
    display: 'side',
    props: {}
  }) as IMessageElement;

describe('canvas side view ownership helpers', () => {
  it('detects canvas shells by workspaceKey', () => {
    expect(isCanvasShellElement(canvasShell('a', 'w1'))).toBe(true);
    expect(isCanvasShellElement(pdfSide('p1'))).toBe(false);
  });

  it('excludes canvas shells so MessagesContainer cannot auto-open them', () => {
    const filtered = excludeCanvasShellElements([
      canvasShell('c1', 'w-old'),
      pdfSide('p1'),
      canvasShell('c2', 'w-new')
    ]);

    expect(filtered.map((element) => element.id)).toEqual(['p1']);
  });

  it('keeps non-canvas side elements eligible for auto-open after canvas prune', () => {
    const sideElements = [canvasShell('c1', 'w1'), pdfSide('p1'), pdfSide('p2')];
    expect(excludeCanvasShellElements(sideElements).map((el) => el.id)).toEqual([
      'p1',
      'p2'
    ]);
  });
});
