import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const canvasContextMenuSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/ui/CanvasContextMenu.jsx'),
  'utf8'
);

describe('CanvasContextMenu', () => {
  it('keeps the expected context menu class hooks in the JSX source', () => {
    expect(canvasContextMenuSource).toContain('className="canvas-editor-context-menu"');
    expect(canvasContextMenuSource).toContain('className="canvas-editor-context-menu-item"');
    expect(canvasContextMenuSource).toContain(
      'className="canvas-editor-context-menu-item is-danger"'
    );
  });
});
