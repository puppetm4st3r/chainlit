import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import React, { act } from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const useToastCanvasEditorSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/hooks/useToastCanvasEditor.js'),
  'utf8'
);

function loadUseToastCanvasEditor(loadCanvasEditorDocxModule: () => Promise<unknown>) {
  const transformedSource = useToastCanvasEditorSource
    .replace('import { useEffect, useRef } from "react";', '')
    .replace('import { loadCanvasEditorDocxModule } from "../loaders.js";', '')
    .replace('export function useToastCanvasEditor', 'function useToastCanvasEditor');
  const executeModule = Function(
    'useEffect',
    'useRef',
    'loadCanvasEditorDocxModule',
    `${transformedSource}\nreturn { useToastCanvasEditor };`
  );
  return (
    executeModule(React.useEffect, React.useRef, loadCanvasEditorDocxModule) as {
      useToastCanvasEditor: (...args: unknown[]) => unknown;
    }
  ).useToastCanvasEditor;
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const flushAnimationFrames = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await flushMicrotasks();
};

class FakeToastEditor {
  public toolbar: HTMLDivElement;
  public trackedGroup: HTMLDivElement;
  public trackedButton: HTMLButtonElement;
  public wwEditor: {
    view: {
      dom: HTMLDivElement;
      setProps: ReturnType<typeof vi.fn>;
      dispatch: (transaction?: unknown) => void;
    };
  };

  public exec = vi.fn();
  public destroy = vi.fn();
  public addCommand = vi.fn((mode: string, name: string, handler: () => boolean) => {
    this.commands.set(`${mode}:${name}`, handler);
  });
  public commands = new Map<string, () => boolean>();

  constructor({ el }: { el: HTMLElement }) {
    el.innerHTML = '';

    const shell = document.createElement('div');
    shell.className = 'toastui-editor-defaultUI';

    const toolbar = document.createElement('div');
    toolbar.className = 'toastui-editor-defaultUI-toolbar';
    this.toolbar = toolbar;

    const trackedGroup = document.createElement('div');
    trackedGroup.className = 'toastui-editor-toolbar-group';
    this.trackedGroup = trackedGroup;

    const trackedButton = document.createElement('button');
    trackedButton.type = 'button';
    trackedButton.className = 'toastui-editor-toolbar-icons custom-tracked-changes';
    trackedGroup.appendChild(trackedButton);
    this.trackedButton = trackedButton;
    toolbar.appendChild(trackedGroup);

    const downloadButton = document.createElement('button');
    downloadButton.type = 'button';
    downloadButton.className = 'toastui-editor-toolbar-icons custom-download';
    toolbar.appendChild(downloadButton);

    const contents = document.createElement('div');
    contents.className = 'toastui-editor-contents';

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    contents.appendChild(editable);

    shell.appendChild(toolbar);
    shell.appendChild(contents);
    el.appendChild(shell);

    this.wwEditor = {
      view: {
        dom: editable,
        setProps: vi.fn(),
        dispatch: () => {},
      },
    };
    (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor }).__lastFakeToastEditor = this;
  }

  public getMarkdown() {
    return '# Draft';
  }

  public rebuildTrackedToolbarButton() {
    this.trackedGroup.remove();
    const nextTrackedGroup = document.createElement('div');
    nextTrackedGroup.className = 'toastui-editor-toolbar-group';
    const nextTrackedButton = document.createElement('button');
    nextTrackedButton.type = 'button';
    nextTrackedButton.className = 'toastui-editor-toolbar-icons custom-tracked-changes';
    nextTrackedGroup.appendChild(nextTrackedButton);
    this.toolbar.insertBefore(nextTrackedGroup, this.toolbar.firstChild);
    this.trackedGroup = nextTrackedGroup;
    this.trackedButton = nextTrackedButton;
  }
}

type HarnessProps = {
  useToastCanvasEditor: ReturnType<typeof loadUseToastCanvasEditor>;
  trackedChanges: {
    available: boolean;
    enabled: boolean;
    checkpointCount: number;
  };
  requestTrackedChangesDialog: () => void;
};

function Harness({
  useToastCanvasEditor,
  trackedChanges,
  requestTrackedChangesDialog,
}: HarnessProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const editorInstanceRef = React.useRef<unknown>(null);
  const isUpdatingFromBackend = React.useRef(false);
  const canonicalContentRef = React.useRef('');
  const pendingChangesRef = React.useRef([]);
  const pendingReadonlyRef = React.useRef(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  useToastCanvasEditor({
    apiClient: { buildEndpoint: (path: string) => path },
    sessionId: 'session-1',
    widgetReadyForUse: true,
    setEditorMounted: vi.fn(),
    setEditorBootError: vi.fn(),
    editorInstanceRef,
    editorRef,
    content: '# Draft',
    REFERENCE_WIDGET_RULE: /\[\[ref\]\]/,
    createReferenceWidgetNode: vi.fn(),
    toolbarLabels: {
      undo: 'Undo',
      redo: 'Redo',
      copy: 'Copy',
      downloadDocx: 'Download DOCX',
      uploadDocx: 'Upload DOCX',
      trackedChangesButton: 'Change control',
      trackedChanges: 'Tracked changes',
      trackedChangesCheckpoint: 'Checkpoint',
      clearEditor: 'Clear',
    },
    isUpdatingFromBackend,
    getCanonicalEditorMarkdown: () => '# Draft',
    canonicalContentRef,
    setContent: vi.fn(),
    pendingChangesRef,
    setPendingChanges: vi.fn(),
    setCurrentPendingChangeIndex: vi.fn(),
    scheduleAutoSave: vi.fn(),
    sendCanvasSave: vi.fn(),
    postBridgeMessage: vi.fn(),
    widgetConfig: {
      filename: 'draft.docx',
      workspaceKey: 'workspace-1',
      widgetInstanceId: 'widget-1',
    },
    pendingReadonlyRef,
    setIsReadonly: vi.fn(),
    logCanvasNonFatalError: vi.fn(),
    applyMarkdownToEditor: vi.fn(),
    uploadInputRef,
    errorLabels: {
      docxUploadFailed: 'Upload failed',
      docxGenerationFailed: 'Generation failed',
      trackedChangesUnavailable: 'Tracked changes unavailable',
      trackedChangesActionFailed: 'Tracked changes failed',
    },
    logCanvasOperation: vi.fn(),
    trackedChanges,
    requestTrackedChangesDialog,
  });

  return (
    <>
      <input ref={uploadInputRef} />
      <div ref={editorRef} />
    </>
  );
}

function buildHarness(useToastCanvasEditor: ReturnType<typeof loadUseToastCanvasEditor>, options: Omit<HarnessProps, 'useToastCanvasEditor'>) {
  return <Harness useToastCanvasEditor={useToastCanvasEditor} {...options} />;
}

describe('useToastCanvasEditor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as typeof window & { toastui?: unknown }).toastui;
    delete (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor }).__lastFakeToastEditor;
  });

  it('uses the latest tracked-changes state for the toolbar command', async () => {
    const startCanvasTrackedChanges = vi.fn().mockResolvedValue(undefined);
    const exportCanvasDocx = vi.fn().mockResolvedValue(undefined);
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges,
      exportCanvasDocx,
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorDocxModule);
    const requestTrackedChangesDialog = vi.fn();

    (window as typeof window & { toastui?: unknown }).toastui = {
      Editor: FakeToastEditor,
    };

    const view = render(
      buildHarness(useToastCanvasEditor, {
        trackedChanges: {
          available: true,
          enabled: false,
          checkpointCount: 1,
        },
        requestTrackedChangesDialog,
      })
    );

    const command = (
      (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor }).__lastFakeToastEditor
        ?.commands.get('markdown:customTrackedChanges')
    );
    expect(command).toBeTypeOf('function');

    await act(async () => {
      command?.();
      await flushMicrotasks();
    });

    expect(startCanvasTrackedChanges).toHaveBeenCalledTimes(1);
    expect(requestTrackedChangesDialog).not.toHaveBeenCalled();

    view.rerender(
      buildHarness(useToastCanvasEditor, {
        trackedChanges: {
          available: true,
          enabled: true,
          checkpointCount: 2,
        },
        requestTrackedChangesDialog,
      })
    );

    await act(async () => {
      command?.();
      await flushMicrotasks();
    });

    expect(startCanvasTrackedChanges).toHaveBeenCalledTimes(1);
    expect(requestTrackedChangesDialog).toHaveBeenCalledTimes(1);
  });

  it('routes download actions through the unified export helper', async () => {
    const exportCanvasDocx = vi.fn().mockResolvedValue(undefined);
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocx,
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorDocxModule);

    (window as typeof window & { toastui?: unknown }).toastui = {
      Editor: FakeToastEditor,
    };

    render(
      buildHarness(useToastCanvasEditor, {
        trackedChanges: {
          available: true,
          enabled: false,
          checkpointCount: 0,
        },
        requestTrackedChangesDialog: vi.fn(),
      })
    );

    const command = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor?.commands.get('markdown:customDownload');
    expect(command).toBeTypeOf('function');

    await act(async () => {
      command?.();
      await flushMicrotasks();
    });

    expect(exportCanvasDocx).toHaveBeenCalledTimes(1);
    expect(exportCanvasDocx.mock.calls[0]?.[0]).toMatchObject({
      apiClient: { buildEndpoint: expect.any(Function) },
      sessionId: 'session-1',
      filename: 'draft.docx',
      content: '# Draft',
    });
    expect(exportCanvasDocx.mock.calls[0]?.[0]).not.toHaveProperty('trackedChanges');
  });

  it('reapplies tracked-changes toolbar decoration after toolbar DOM rebuilds', async () => {
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocx: vi.fn().mockResolvedValue(undefined),
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorDocxModule);

    (window as typeof window & { toastui?: unknown }).toastui = {
      Editor: FakeToastEditor,
    };

    render(
      buildHarness(useToastCanvasEditor, {
        trackedChanges: {
          available: true,
          enabled: false,
          checkpointCount: 0,
        },
        requestTrackedChangesDialog: vi.fn(),
      })
    );

    const editor = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor;
    expect(editor).toBeDefined();
    expect(editor?.trackedGroup.classList.contains('canvas-tracked-changes-group')).toBe(true);
    expect(editor?.trackedButton.dataset.buttonLabel).toBe('Change control');

    await act(async () => {
      editor?.rebuildTrackedToolbarButton();
      await flushMicrotasks();
      await flushAnimationFrames();
    });

    expect(editor?.trackedGroup.classList.contains('canvas-tracked-changes-group')).toBe(true);
    expect(editor?.trackedButton.dataset.buttonLabel).toBe('Change control');
    expect(editor?.trackedButton.getAttribute('aria-label')).toBe('Tracked changes');
  });
});
