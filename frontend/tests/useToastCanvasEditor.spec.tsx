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
    .replace('import { decodeVisibleSpaceRuns } from "../whitespace.js";', '')
    .replace('export function useToastCanvasEditor', 'function useToastCanvasEditor');
  const executeModule = Function(
    'useEffect',
    'useRef',
    'loadCanvasEditorDocxModule',
    'decodeVisibleSpaceRuns',
    `${transformedSource}\nreturn { useToastCanvasEditor };`
  );
  return (
    executeModule(
      React.useEffect,
      React.useRef,
      loadCanvasEditorDocxModule,
      (value: unknown) => String(value ?? '').replace(/\u00a0/g, ' ')
    ) as {
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
  public commentsGroup: HTMLDivElement;
  public commentsButton: HTMLButtonElement;
  public trackedGroup: HTMLDivElement;
  public trackedButton: HTMLButtonElement;
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

    const sharedReviewGroup = document.createElement('div');
    sharedReviewGroup.className = 'toastui-editor-toolbar-group';
    this.commentsGroup = sharedReviewGroup;

    const commentsButton = document.createElement('button');
    commentsButton.type = 'button';
    commentsButton.className = 'toastui-editor-toolbar-icons custom-comments';
    sharedReviewGroup.appendChild(commentsButton);
    this.commentsButton = commentsButton;

    this.trackedGroup = sharedReviewGroup;

    const trackedButton = document.createElement('button');
    trackedButton.type = 'button';
    trackedButton.className = 'toastui-editor-toolbar-icons custom-tracked-changes';
    sharedReviewGroup.appendChild(trackedButton);
    this.trackedButton = trackedButton;
    toolbar.appendChild(sharedReviewGroup);

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
  commentsPanelOpen?: boolean;
  toggleCommentsPanel?: () => void;
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
  commentsPanelOpen = false,
  toggleCommentsPanel = vi.fn(),
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
    },
    logCanvasOperation: vi.fn(),
    commentsButtonLabel: 'Comments',
    commentThreads,
    commentsPanelOpen,
    detachedCommentThreadIds: [],
    toggleCommentsPanel,
    commentDecorationsController,
    trackedChangesDecorationsController,
    setWidgetConfig: vi.fn(),
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
    expect(exportCanvasDocx.mock.calls[0]?.[0]).not.toHaveProperty('trackedChanges');
  });

  it('registers comment and tracked-changes decoration plugins together', () => {
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocx: vi.fn().mockResolvedValue(undefined),
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorDocxModule);
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
    expect(editor?.trackedButton.dataset.tooltipLabel).toBe('Tracked changes');
    expect(editor?.trackedButton.hasAttribute('title')).toBe(false);
    editor?.trackedButton.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 320,
        clientY: 36,
      })
    );
    const tooltip = document.body.querySelector('.canvas-editor-toolbar-tooltip');
    expect(tooltip?.textContent).toBe('Tracked changes');
    expect((tooltip as HTMLElement | null)?.hidden).toBe(false);

    await act(async () => {
      editor?.rebuildTrackedToolbarButton();
      await flushMicrotasks();
      await flushAnimationFrames();
    });

    expect(editor?.trackedGroup.classList.contains('canvas-tracked-changes-group')).toBe(true);
    expect(editor?.trackedButton.dataset.buttonLabel).toBe('Change control');
    expect(editor?.trackedButton.getAttribute('aria-label')).toBe('Tracked changes');
    expect(editor?.trackedButton.hasAttribute('title')).toBe(false);
  });

  it('uses the latest comments-panel toggle state for the toolbar command', async () => {
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocx: vi.fn().mockResolvedValue(undefined),
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorDocxModule);
    const toggleCommentsPanel = vi.fn();

    (window as typeof window & { toastui?: unknown }).toastui = {
      Editor: FakeToastEditor,
    };

    const view = render(
      buildHarness(useToastCanvasEditor, {
        commentsPanelOpen: false,
        toggleCommentsPanel,
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
    const command = editor?.commands.get('markdown:customComments');
    expect(command).toBeTypeOf('function');
    expect(editor?.commentsButton.dataset.buttonLabel).toBe('Comments');
    expect(editor?.commentsButton.classList.contains('active')).toBe(false);

    await act(async () => {
      command?.();
      await flushMicrotasks();
    });

    expect(toggleCommentsPanel).toHaveBeenCalledTimes(1);

    view.rerender(
      buildHarness(useToastCanvasEditor, {
        commentsPanelOpen: true,
        toggleCommentsPanel,
        trackedChanges: {
          available: true,
          enabled: false,
          checkpointCount: 0,
        },
        requestTrackedChangesDialog: vi.fn(),
      })
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    expect(editor?.commentsButton.classList.contains('active')).toBe(true);
    expect(editor?.commentsButton.getAttribute('aria-label')).toBe('Comments (1)');
    expect(editor?.commentsButton.dataset.tooltipLabel).toBe('Comments');
    expect(editor?.commentsButton.dataset.unresolvedCount).toBe('1');
    expect(editor?.commentsButton.classList.contains('has-unresolved-comments')).toBe(true);
    expect(editor?.commentsButton.hasAttribute('title')).toBe(false);
  });

  it('shows unresolved comment count on the comments toolbar button', async () => {
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocx: vi.fn().mockResolvedValue(undefined),
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorDocxModule);

    (window as typeof window & { toastui?: unknown }).toastui = {
      Editor: FakeToastEditor,
    };

    const view = render(
      buildHarness(useToastCanvasEditor, {
        commentsPanelOpen: false,
        commentThreads: [
          { commentThreadId: 'comment-thread-open-1', status: 'open' },
          { commentThreadId: 'comment-thread-open-2', status: 'open' },
          { commentThreadId: 'comment-thread-resolved', status: 'resolved' },
        ],
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
    expect(editor?.commentsButton.dataset.unresolvedCount).toBe('2');
    expect(editor?.commentsButton.classList.contains('has-unresolved-comments')).toBe(true);
    expect(editor?.commentsButton.getAttribute('aria-label')).toBe('Comments (2)');

    view.rerender(
      buildHarness(useToastCanvasEditor, {
        commentsPanelOpen: false,
        commentThreads: [
          { commentThreadId: 'comment-thread-resolved-1', status: 'resolved' },
          { commentThreadId: 'comment-thread-resolved-2', status: 'resolved' },
        ],
        trackedChanges: {
          available: true,
          enabled: false,
          checkpointCount: 0,
        },
        requestTrackedChangesDialog: vi.fn(),
      })
    );

    await act(async () => {
      await flushAnimationFrames();
    });

    const updatedEditor = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor;
    expect(updatedEditor?.commentsButton.dataset.unresolvedCount).toBeUndefined();
    expect(updatedEditor?.commentsButton.classList.contains('has-unresolved-comments')).toBe(false);
    expect(updatedEditor?.commentsButton.getAttribute('aria-label')).toBe('Comments');
  });

  it('keeps comments visible when tracked changes are unavailable', () => {
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
        commentsPanelOpen: false,
        trackedChanges: {
          available: false,
          enabled: false,
          checkpointCount: 0,
        },
        requestTrackedChangesDialog: vi.fn(),
      })
    );

    const editor = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor;
    expect(editor?.commentsButton.nextElementSibling).toBe(editor?.trackedButton);
    expect(editor?.commentsButton.style.display).toBe('');
    expect(editor?.trackedButton.style.display).toBe('none');
    expect(editor?.trackedGroup.style.display).toBe('');
  });

  it('schedules autosave when WYSIWYG input only changes preserved spaces', async () => {
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges: vi.fn().mockResolvedValue(undefined),
      exportCanvasDocx: vi.fn().mockResolvedValue(undefined),
    }));
    const useToastCanvasEditor = loadUseToastCanvasEditor(loadCanvasEditorDocxModule);
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
    const exportCanvasDocx = vi.fn().mockResolvedValue(undefined);
    const loadCanvasEditorDocxModule = vi.fn(async () => ({
      startCanvasTrackedChanges,
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
        getCanonicalEditorMarkdown: () => 'foo\u00a0 bar',
      })
    );

    const editor = (window as typeof window & { __lastFakeToastEditor?: FakeToastEditor })
      .__lastFakeToastEditor;
    await act(async () => {
      editor?.commands.get('markdown:customTrackedChanges')?.();
      editor?.commands.get('markdown:customDownload')?.();
      await flushMicrotasks();
    });

    expect(startCanvasTrackedChanges.mock.calls[0]?.[0]?.content).toBe('foo  bar');
    expect(exportCanvasDocx.mock.calls[0]?.[0]?.content).toBe('foo  bar');
  });
});
