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
      apiClient?: { post?: (path: string, data: FormData) => Promise<Response> };
      errorLabels: Record<string, string>;
      applyMarkdownToEditor: (markdown: string) => void;
      sendCanvasSave: (markdown: string, source: string) => void;
    }) => Promise<void>;
  };
}

describe('canvas editor DOCX helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { __canvasEditorDocxModule?: unknown })
      .__canvasEditorDocxModule;
  });

  it('uses apiClient.post for DOCX import when available', async () => {
    const docxModule = loadCanvasEditorDocxModule();
    const apiClient = {
      post: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ markdown: '# Converted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const applyMarkdownToEditor = vi.fn();
    const sendCanvasSave = vi.fn();

    await docxModule.importCanvasDocx({
      event: {
        target: {
          files: [new File(['docx-bytes'], 'draft.docx')]
        }
      },
      apiClient,
      errorLabels: {
        docxOnly: 'Only .docx files are supported.',
        docxConversionFailed: 'DOCX conversion failed:',
        docxUploadFailed: 'DOCX upload failed:'
      },
      applyMarkdownToEditor,
      sendCanvasSave
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/canvas/docx-to-md',
      expect.any(FormData)
    );
    const formData = apiClient.post.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBeInstanceOf(File);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(applyMarkdownToEditor).toHaveBeenCalledWith('# Converted');
    expect(sendCanvasSave).toHaveBeenCalledWith('# Converted', 'docx_import');
  });
});
