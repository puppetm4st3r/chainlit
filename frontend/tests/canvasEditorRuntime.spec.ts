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

  it('unwraps presentation HTML tags while keeping visible text', () => {
    const runtimeModule = loadCanvasEditorRuntimeModule();

    expect(runtimeModule.bridgeCanonicalToEditorView('<center>ARRENDADOR</center>')).toBe(
      'ARRENDADOR'
    );
    expect(
      runtimeModule.bridgeLinesToBackendCanonical('Texto con <a href="https://www.dolfs.io/">link</a>')
    ).toBe('Texto con link');
  });

  it('ignores document-pipeline media markers until canvas image support exists', () => {
    const runtimeModule = loadCanvasEditorRuntimeModule();
    const line = '<m uri="img_1" />';

    expect(runtimeModule.bridgeCanonicalToEditorView(line)).toBe('');
    expect(runtimeModule.bridgeLinesToBackendCanonical(line)).toBe('');
    expect(
      runtimeModule.bridgeCanonicalToEditorView('Before\n\n<m uri="tenant/x/img_1" />\n\nAfter')
    ).toBe('Before\n\n<br>\nAfter');
    expect(
      runtimeModule.bridgeCanonicalToEditorView('Caption <m uri="img_1" /> continues')
    ).toBe('Caption  continues');
  });

  it('unwraps non-media HTML after ignoring media markers on the same line', () => {
    const runtimeModule = loadCanvasEditorRuntimeModule();

    expect(runtimeModule.bridgeLinesToBackendCanonical('<m uri="img_1" /><div>bad</div>')).toBe(
      'bad'
    );
  });
});