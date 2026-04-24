import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const canvasEditorRuntimeSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor-runtime.js'),
  'utf8'
);

function loadCanvasEditorRuntimeModule() {
  delete (globalThis as typeof globalThis & { __canvasEditorRuntimeModule?: unknown })
    .__canvasEditorRuntimeModule;
  const executeModule = Function(
    `${canvasEditorRuntimeSource}\nreturn globalThis.__canvasEditorRuntimeModule;`
  );
  return executeModule() as {
    bridgeCanonicalToEditorView: (markdown: string) => string;
    bridgeLinesToBackendCanonical: (markdown: string) => string;
  };
}

describe('canvas editor runtime bridge', () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __canvasEditorRuntimeModule?: unknown })
      .__canvasEditorRuntimeModule;
  });

  it('preserves markdown autolinks instead of treating them as HTML artifacts', () => {
    const runtimeModule = loadCanvasEditorRuntimeModule();
    const line =
      'Junto con saludar, envío este mensaje para presentar una solución desarrolla desde la startup chilena **Dolfs AI** (~~www.~~ <https://www.dolfs.io/>).';

    expect(runtimeModule.bridgeCanonicalToEditorView(line)).toBe(line);
    expect(runtimeModule.bridgeLinesToBackendCanonical(line)).toBe(line);
  });

  it('still rejects real HTML tags in canonical content', () => {
    const runtimeModule = loadCanvasEditorRuntimeModule();

    expect(() => runtimeModule.bridgeCanonicalToEditorView('Texto con <a href="https://www.dolfs.io/">link</a>')).toThrow(
      /Unsupported HTML artifact/
    );
  });
});
