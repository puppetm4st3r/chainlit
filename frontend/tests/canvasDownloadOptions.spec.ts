import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const downloadOptionsSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/downloadOptions.js'),
  'utf8'
);

function loadDownloadOptionsModule() {
  return Function(
    `${downloadOptionsSource.replace(/export /g, '')}\nreturn { getDownloadOptions, getDownloadButtonStateFromOptions };`
  )() as {
    getDownloadOptions: (
      widgetConfig: unknown,
      toolbarLabels: unknown
    ) => Array<{ id: string; label: string }>;
    getDownloadButtonStateFromOptions: (
      options: Array<{ id: string; label: string }>,
      toolbarLabels: unknown,
      exportInProgress: boolean
    ) => { disabled: boolean; tooltip: string };
  };
}

describe('canvas download options', () => {
  const toolbarLabels = {
    downloadDocument: 'Download {{format}}',
    downloadOptions: 'Download',
    downloadUnavailable: 'Download unavailable',
    generatingDocument: 'Generating {{format}}...',
  };

  it('returns no options when neither local nor host export is configured', () => {
    const { getDownloadOptions } = loadDownloadOptionsModule();
    expect(getDownloadOptions({}, toolbarLabels)).toEqual([]);
  });

  it('returns only local export when exportSettings are present', () => {
    const { getDownloadOptions } = loadDownloadOptionsModule();
    expect(
      getDownloadOptions(
        { exportSettings: { outputFormat: 'pdf' } },
        toolbarLabels
      )
    ).toEqual([{ id: 'local-export', label: 'Download PDF' }]);
  });

  it('returns only postMessage export when configured', () => {
    const { getDownloadOptions } = loadDownloadOptionsModule();
    expect(
      getDownloadOptions(
        {
          postMessageExport: {
            label: 'Open host',
          },
        },
        toolbarLabels
      )
    ).toEqual([{ id: 'postmessage-export', label: 'Open host' }]);
  });

  it('merges local export before postMessage export', () => {
    const { getDownloadOptions } = loadDownloadOptionsModule();
    expect(
      getDownloadOptions(
        {
          exportSettings: { outputFormat: 'docx' },
          postMessageExport: {
            label: 'Open host',
          },
        },
        toolbarLabels
      )
    ).toEqual([
      { id: 'local-export', label: 'Download DOCX' },
      { id: 'postmessage-export', label: 'Open host' },
    ]);
  });

  it('uses the shared download label when multiple options are available', () => {
    const { getDownloadOptions, getDownloadButtonStateFromOptions } =
      loadDownloadOptionsModule();
    const options = getDownloadOptions(
      {
        exportSettings: { outputFormat: 'docx' },
        postMessageExport: {
          label: 'Open host',
        },
      },
      toolbarLabels
    );
    expect(getDownloadButtonStateFromOptions(options, toolbarLabels, false)).toEqual({
      disabled: false,
      tooltip: 'Download',
    });
  });
});
