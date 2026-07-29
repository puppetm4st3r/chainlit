import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/config.js'),
  'utf8'
);

function loadCanvasConfigModule() {
  return Function(
    `${configSource.replace(/export /g, '')}\nreturn { extractCanvasWidgetConfig, mergeCanvasWidgetConfig };`
  )() as {
    extractCanvasWidgetConfig: (rawProps: unknown) => {
      postMessageExport: { label: string } | null;
      exportSettings: unknown;
    };
    mergeCanvasWidgetConfig: (
      currentConfig: Record<string, unknown>,
      rawProps: Record<string, unknown>
    ) => {
      postMessageExport: { label: string } | null;
    };
  };
}

describe('canvas widget config postMessageExport', () => {
  it('extracts only complete postMessageExport payloads', () => {
    const { extractCanvasWidgetConfig } = loadCanvasConfigModule();
    expect(extractCanvasWidgetConfig({}).postMessageExport).toBeNull();
    expect(
      extractCanvasWidgetConfig({
        postMessageExport: { label: '' }
      }).postMessageExport
    ).toBeNull();
    expect(
      extractCanvasWidgetConfig({
        postMessageExport: {
          label: ' Open host '
        }
      }).postMessageExport
    ).toEqual({
      label: 'Open host'
    });
  });

  it('merges postMessageExport only when the key is present on incoming props', () => {
    const { extractCanvasWidgetConfig, mergeCanvasWidgetConfig } =
      loadCanvasConfigModule();
    const currentConfig = extractCanvasWidgetConfig({
      postMessageExport: {
        label: 'Current'
      }
    });
    const preserved = mergeCanvasWidgetConfig(currentConfig, {
      filename: 'doc.md'
    });
    expect(preserved.postMessageExport).toEqual({
      label: 'Current'
    });

    const replaced = mergeCanvasWidgetConfig(currentConfig, {
      postMessageExport: {
        label: 'Next'
      }
    });
    expect(replaced.postMessageExport).toEqual({
      label: 'Next'
    });

    const cleared = mergeCanvasWidgetConfig(currentConfig, {
      postMessageExport: null
    });
    expect(cleared.postMessageExport).toBeNull();
  });
});
