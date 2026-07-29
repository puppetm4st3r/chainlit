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

function loadUseToastCanvasEditor(loadCanvasEditorExportModule: () => Promise<unknown>) {
  const downloadOptionsSource = readFileSync(
    resolve(__dirname, '../../../../backend/public/elements/canvas-editor/downloadOptions.js'),
    'utf8'
  );
  const downloadOptionsModule = Function(
    `${downloadOptionsSource.replace(/export /g, '')}\nreturn { getDownloadOptions, getDownloadButtonStateFromOptions };`
  )() as {
    getDownloadOptions: (...args: unknown[]) => unknown;
    getDownloadButtonStateFromOptions: (...args: unknown[]) => unknown;
  };
  const transformedSource = useToastCanvasEditorSource
    .replace('import { useEffect, useRef } from "react";', '')
    .replace('import { loadCanvasEditorExportModule } from "../loaders.js";', '')
    .replace('import { decodeVisibleSpaceRuns } from "../whitespace.js";', '')
    .replace(
      'import {\n  getDownloadButtonStateFromOptions,\n  getDownloadOptions,\n} from "../downloadOptions.js";',
      ''
    )
    .replace('export function useToastCanvasEditor', 'function useToastCanvasEditor');
  const executeModule = Function(
    'useEffect',
    'useRef',
    'loadCanvasEditorExportModule',
    'decodeVisibleSpaceRuns',
    'getDownloadOptions',
    'getDownloadButtonStateFromOptions',
    `${transformedSource}\nreturn { useToastCanvasEditor };`
  );
  return (
    executeModule(
      React.useEffect,
      React.useRef,
      loadCanvasEditorExportModule,
      (value: unknown) => String(value ?? '').replace(/\u00a0/g, ' '),
      downloadOptionsModule.getDownloadOptions,
      downloadOptionsModule.getDownloadButtonStateFromOptions
    ) as {
      useToastCanvasEditor: (...args: unknown[]) => unknown;
    }
  ).useToastCanvasEditor;
}

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

class FakeToastEditor {
  public toolbar: HTMLDivElement;
  public plugins: Array<(context: unknown) => unknown>;
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

  constructor({ el, plugins = [] }: { el: HTMLElement; plugins?: Array<(context: unknown) => unknown> }) {
    this.plugins = plugins;
    el.innerHTML = '';

    const shell = document.createElement('div');
    shell.className = 'toastui-editor-defaultUI';

    const toolbar = document.createElement('div');
    toolbar.className = 'toastui-editor-defaultUI-toolbar';
    this.toolbar = toolbar;

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
}

type HarnessProps = {
  useToastCanvasEditor: ReturnType<typeof loadUseToastCanvasEditor>;
  trackedChanges: {
    available: boolean;
    enabled: boolean;
    checkpointCount: number;
  };
  requestTrackedChangesDialog: () => void;
  getCanonicalEditorMarkdown?: () => string;
  scheduleAutoSave?: ReturnType<typeof vi.fn>;
  commentThreads?: Array<Record<string, unknown>>;
  commentDecorationsController?: Record<string, unknown>;
  trackedChangesDecorationsController?: Record<string, unknown>;
};

function Harness({
  useToastCanvasEditor,
  trackedChanges,
  requestTrackedChangesDialog,
  getCanonicalEditorMarkdown = () => '# Draft',
  scheduleAutoSave = vi.fn(),
  commentDecorationsController,
  commentThreads = [
    {
      commentThreadId: 'comment-thread-1',
      status: 'open',
      anchor: { quote: 'Draft', prefix: '# ', suffix: '' },
      comments: [],
      docxCommentId: '',
    },
  ],
  trackedChangesDecorationsController,
}: HarnessProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const editorInstanceRef = React.useRef<unknown>(null);
  const isUpdatingFromBackend = React.useRef(false);
  const canonicalContentRef = React.useRef('');
  const pendingChangesRef = React.useRef([]);
  const pendingReadonlyRef = React.useRef(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);

  const { handleTrackedChangesClick } = useToastCanvasEditor({
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
      downloadDocument: 'Download {{format}}',
      downloadOptions: 'Download',
      downloadUnavailable: 'Download unavailable',
      generatingDocument: 'Generating {{format}}...',
      uploadDocx: 'Upload DOCX',
      trackedChangesButton: 'Change control',
      trackedChanges: 'Tracked changes',
      trackedChangesCheckpoint: 'Checkpoint',
      clearEditor: 'Clear',
    },
    isUpdatingFromBackend,
    getCanonicalEditorMarkdown,
    canonicalContentRef,
    setContent: vi.fn(),
    pendingChangesRef,
    setPendingChanges: vi.fn(),
    setCurrentPendingChangeIndex: vi.fn(),
    scheduleAutoSave,
    sendCanvasSave: vi.fn(),
    markImportedDocumentPersisted: vi.fn(),
    postBridgeMessage: vi.fn(),
    widgetConfig: {
      filename: 'draft.docx',
      workspaceKey: 'workspace-1',
      widgetInstanceId: 'widget-1',
      exportSettings: {
        sourceFileEditorNodeId: 'file-editor-1',
        outputFormat: 'docx',
        enableHeader: false,
        headerAssetRef: null,
        enableFooter: false,
        footerText: '',
        showPageXOfY: false,
        justifyParagraphs: true,
      },
    },
    pendingReadonlyRef,
    setIsReadonly: vi.fn(),
    logCanvasNonFatalError: vi.fn(),
    applyMarkdownToEditor: vi.fn(),
    uploadInputRef,
    errorLabels: {
      docxUploadFailed: 'Upload failed',
      docxGenerationFailed: 'Generation failed',
      detachedCommentsExport: 'Detached comments block export',
      trackedChangesUnavailable: 'Tracked changes unavailable',
      trackedChangesActionFailed: 'Tracked changes failed',
      exportContractViolation: 'Export contract violation',
      exportRenderFailed: 'Export render failed',
    },
    logCanvasOperation: vi.fn(),
    commentThreads,
    detachedCommentThreadIds: [],
    commentDecorationsController,
    trackedChangesDecorationsController,
    setWidgetConfig: vi.fn(),
    trackedChanges,
    requestTrackedChangesDialog,
  }) as { handleTrackedChangesClick: () => Promise<void> };

  React.useEffect(() => {
    (window as typeof window & {
      __canvasEditorHandlers?: { handleTrackedChangesClick: () => Promise<void> };
    }).__canvasEditorHandlers = { handleTrackedChangesClick };
  }, [handleTrackedChangesClick]);

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
    delete (window as typeof window & {
      __canvasEditorHandlers?: { handleTrackedChangesClick: () => Promise<void> };
    }).__canvasEditorHandlers;
  });

  it('uses the latest tracked-changes state for the header action', async () => {
    const startCanvasTrackedChanges = vi.fn().mockResolvedValue(undefined);
    const exportCanvasDocument = vi.fn().mockResolvedValue(undefined);
    const loadCanvasEditorExportModule = vi.fn(async () => ({
      startCanvasTrackedChanges,
      exportCanvasDocument,
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorExportModule);
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

    const getHandler = () =>
      (window as typeof window & {
        __canvasEditorHandlers?: { handleTrackedChangesClick: () => Promise<void> };
      }).__canvasEditorHandlers?.handleTrackedChangesClick;

    expect(getHandler()).toBeTypeOf('function');

    await act(async () => {
      await getHandler()?.();
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
      await getHandler()?.();
      await flushMicrotasks();
    });

    expect(startCanvasTrackedChanges).toHaveBeenCalledTimes(1);
    expect(requestTrackedChangesDialog).toHaveBeenCalledTimes(1);
  });

  it('routes download actions through the unified export helper', async () => {
    const exportCanvasDocument = vi.fn().mockResolvedValue(undefined);
    const loadCanvasEditorExportModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocument,
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorExportModule);

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

    expect(exportCanvasDocument).toHaveBeenCalledTimes(1);
    expect(exportCanvasDocument.mock.calls[0]?.[0]).toMatchObject({
      apiClient: { buildEndpoint: expect.any(Function) },
      sessionId: 'session-1',
      filename: 'draft.docx',
      content: '# Draft',
      commentThreads: [
        {
          commentThreadId: 'comment-thread-1',
          status: 'open',
          anchor: { quote: 'Draft', prefix: '# ', suffix: '' },
          comments: [],
          docxCommentId: '',
        },
      ],
      detachedCommentThreadIds: [],
    });
    expect(exportCanvasDocument.mock.calls[0]?.[0]).not.toHaveProperty('trackedChanges');
  });

  it('registers comment and tracked-changes decoration plugins together', () => {
    const loadCanvasEditorExportModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocument: vi.fn().mockResolvedValue(undefined),
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorExportModule);
    const commentDecorationsController = {
      toastUiPlugin: vi.fn(() => ({ wysiwygPlugins: [] })),
    };
    const trackedChangesDecorationsController = {
      toastUiPlugin: vi.fn(() => ({ wysiwygPlugins: [] })),
    };

    (window as typeof window & { toastui?: unknown }).toastui = {
      Editor: FakeToastEditor,
    };

    render(
      buildHarness(useToastCanvasEditor, {
        trackedChanges: {
          available: true,
          enabled: true,
          checkpointCount: 1,
        },
        requestTrackedChangesDialog: vi.fn(),
        commentDecorationsController,
        trackedChangesDecorationsController,
      })
    );

    const editor = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor;
    expect(editor?.plugins).toHaveLength(2);
    editor?.plugins.forEach((plugin) => plugin({ pmState: {}, pmView: {} }));

    expect(commentDecorationsController.toastUiPlugin).toHaveBeenCalledTimes(1);
    expect(trackedChangesDecorationsController.toastUiPlugin).toHaveBeenCalledTimes(1);
  });

  it('schedules autosave when WYSIWYG input only changes preserved spaces', async () => {
    const loadCanvasEditorExportModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocument: vi.fn().mockResolvedValue(undefined),
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorExportModule);
    const scheduleAutoSave = vi.fn();

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
        getCanonicalEditorMarkdown: () => 'foo\u00a0 bar',
        scheduleAutoSave,
      })
    );

    const editor = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor;
    await act(async () => {
      editor?.wwEditor.view.dom.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flushMicrotasks();
    });

    expect(scheduleAutoSave).toHaveBeenCalledWith('foo\u00a0 bar');
  });

  it('decodes preserved spaces before tracked changes and DOCX actions leave the editor', async () => {
    const startCanvasTrackedChanges = vi.fn().mockResolvedValue(undefined);
    const exportCanvasDocument = vi.fn().mockResolvedValue(undefined);
    const loadCanvasEditorExportModule = vi.fn(async () => ({
      startCanvasTrackedChanges,
      exportCanvasDocument,
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorExportModule);

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
        getCanonicalEditorMarkdown: () => 'foo\u00a0 bar',
      })
    );

    const editor = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor;
    const handleTrackedChangesClick = (window as typeof window & {
      __canvasEditorHandlers?: { handleTrackedChangesClick: () => Promise<void> };
    }).__canvasEditorHandlers?.handleTrackedChangesClick;

    await act(async () => {
      await handleTrackedChangesClick?.();
      editor?.commands.get('markdown:customDownload')?.();
      await flushMicrotasks();
    });

    expect(startCanvasTrackedChanges.mock.calls[0]?.[0]?.content).toBe('foo  bar');
    expect(exportCanvasDocument.mock.calls[0]?.[0]?.content).toBe('foo  bar');
  });
});
