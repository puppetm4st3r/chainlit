import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const canvasEditorDocxSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor-docx.js'),
  'utf8'
);

function loadCanvasEditorDocxModule() {
  delete (globalThis as typeof globalThis & { __canvasEditorDocxModule?: unknown })
    .__canvasEditorDocxModule;
  const executeModule = Function(
    `${canvasEditorDocxSource}\nreturn globalThis.__canvasEditorDocxModule;`
  );
  return executeModule() as {
    importCanvasDocx: (args: {
      event: { target: { files?: File[] } };
      apiClient?: { buildEndpoint?: (path: string) => string };
      sessionId?: string;
      errorLabels: Record<string, string>;
      applyMarkdownToEditor: (markdown: string) => void;
      markImportedDocumentPersisted?: (args: {
        markdown: string;
        revision?: number;
      }) => void;
      setWidgetConfig?: (updater: (currentConfig: Record<string, unknown>) => Record<string, unknown>) => void;
    }) => Promise<void>;
    exportCanvasDocx: (args: {
      apiClient?: { buildEndpoint?: (path: string) => string };
      sessionId?: string;
      errorLabels: Record<string, string>;
      filename?: string;
      content?: string;
      commentThreads?: Record<string, unknown>[];
      detachedCommentThreadIds?: string[];
    }) => Promise<void>;
    startCanvasTrackedChanges?: (args: {
      apiClient?: { buildEndpoint?: (path: string) => string };
      sessionId?: string;
      content?: string;
      errorLabels: Record<string, string>;
    }) => Promise<void>;
    stopCanvasTrackedChanges?: (args: {
      apiClient?: { buildEndpoint?: (path: string) => string };
      sessionId?: string;
      content?: string;
      errorLabels: Record<string, string>;
    }) => Promise<void>;
  };
}

describe('canvas editor DOCX helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { __canvasEditorDocxModule?: unknown })
      .__canvasEditorDocxModule;
  });

  it('imports DOCX through the backend workspace route', async () => {
    const docxModule = loadCanvasEditorDocxModule();
    const apiClient = {
      buildEndpoint: vi.fn((path: string) => path)
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          markdown: '# Converted',
          filename: 'draft.docx',
          revision: 7,
          trackedChanges: { available: true, enabled: false, checkpointCount: 0 },
          commentThreads: [
            {
              commentThreadId: 'comment-thread-1',
              status: 'open',
              anchor: { quote: 'Converted', prefix: '# ', suffix: '' },
              comments: [],
              docxCommentId: ''
            }
          ]
        }),
        {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
        }
      )
    );
    const applyMarkdownToEditor = vi.fn();
    const markImportedDocumentPersisted = vi.fn();
    const setWidgetConfig = vi.fn();

    await docxModule.importCanvasDocx({
      event: {
        target: {
          files: [new File(['docx-bytes'], 'draft.docx')]
        }
      },
      apiClient,
      sessionId: 'session-1',
      errorLabels: {
        docxOnly: 'Only .docx files are supported.',
        docxConversionFailed: 'DOCX conversion failed:',
        docxUploadFailed: 'DOCX upload failed:'
      },
      applyMarkdownToEditor,
      markImportedDocumentPersisted,
      setWidgetConfig
    });

    expect(apiClient.buildEndpoint).toHaveBeenCalledWith('/api/canvas/document-workspace/import');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchSpy.mock.calls[0];
    expect(requestUrl).toBe('/api/canvas/document-workspace/import');
    expect(requestInit?.method).toBe('POST');
    expect((requestInit?.body as FormData).get('file')).toBeInstanceOf(File);
    expect(requestInit?.headers).toMatchObject({
      'x-session-id': 'session-1',
      'X-Requested-With': 'XMLHttpRequest'
    });
    expect(applyMarkdownToEditor).toHaveBeenCalledWith('# Converted');
    expect(setWidgetConfig).toHaveBeenCalledTimes(1);
    expect(markImportedDocumentPersisted).toHaveBeenCalledWith({
      markdown: '# Converted',
      revision: 7
    });
  });

  it('exports DOCX through the unified backend route', async () => {
    const docxModule = loadCanvasEditorDocxModule();
    const apiClient = {
      buildEndpoint: vi.fn((path: string) => path)
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['docx-bytes']), {
        status: 200,
        headers: {
          'Content-Disposition': 'attachment; filename="draft.docx"'
        }
      })
    );
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:tracked-docx');
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await docxModule.exportCanvasDocx({
      apiClient,
      sessionId: 'session-1',
      errorLabels: {
        docxGenerationFailed: 'DOCX generation failed:',
        detachedCommentsExport: 'Detached comments block export.'
      },
      filename: 'draft.docx',
      content: '# Draft\u00a0 copy',
      commentThreads: [
        {
          commentThreadId: 'comment-thread-1',
          status: 'open',
          anchor: { quote: 'Draft\u00a0 copy', prefix: '# ', suffix: '' },
          comments: [],
          docxCommentId: ''
        }
      ],
      detachedCommentThreadIds: []
    });

    expect(apiClient.buildEndpoint).toHaveBeenCalledWith('/api/canvas/document-workspace/export-docx');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchSpy.mock.calls[0];
    expect(requestUrl).toBe('/api/canvas/document-workspace/export-docx');
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-session-id': 'session-1'
    });
    expect(requestInit?.body).toBe(
      JSON.stringify({
        content: '# Draft  copy',
        filename: 'draft.docx',
        commentThreads: [
          {
            commentThreadId: 'comment-thread-1',
            status: 'open',
            anchor: { quote: 'Draft  copy', prefix: '# ', suffix: '' },
            comments: [],
            docxCommentId: ''
          }
        ],
        detachedCommentThreadIds: []
      })
    );
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:tracked-docx');
  });

  it('blocks export when detached comments are present', async () => {
    const docxModule = loadCanvasEditorDocxModule();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await docxModule.exportCanvasDocx({
      sessionId: 'session-1',
      errorLabels: {
        docxGenerationFailed: 'DOCX generation failed:',
        detachedCommentsExport: 'Detached comments block export.'
      },
      filename: 'draft.docx',
      content: '# Draft',
      commentThreads: [],
      detachedCommentThreadIds: ['comment-thread-1']
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Detached comments block export.');
  });

  it('decodes preserved spaces before starting tracked changes', async () => {
    const docxModule = loadCanvasEditorDocxModule();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await docxModule.startCanvasTrackedChanges?.({
      sessionId: 'session-1',
      content: 'foo\u00a0 bar',
      errorLabels: {
        trackedChangesActionFailed: 'Tracked changes failed'
      }
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        content: 'foo  bar'
      })
    );
  });
});
