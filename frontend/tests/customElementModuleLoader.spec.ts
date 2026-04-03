import { describe, expect, it, vi } from 'vitest';

import {
  extractRelativeImportSpecifiers,
  loadCustomElementModuleTree,
  resolveRelativeModulePath
} from '../src/components/Elements/CustomElement/moduleLoader';

describe('custom element module loader', () => {
  it('extracts only relative imports from multiline source', () => {
    const sourceCode = `
      import React from "react";
      import {
        useCanvasAutosave,
        useCanvasReview,
      } from "./canvas-editor/hooks/useCanvasHooks.js";
      import { Button } from "@/components/ui/button";
      import "./canvas-editor/setup.js";
    `;

    expect(extractRelativeImportSpecifiers(sourceCode)).toEqual([
      './canvas-editor/hooks/useCanvasHooks.js',
      './canvas-editor/setup.js',
    ]);
  });

  it('resolves parent-relative imports against nested modules', () => {
    expect(
      resolveRelativeModulePath(
        'canvas-editor/hooks/useToastCanvasEditor.js',
        '../loaders.js'
      )
    ).toBe('canvas-editor/loaders.js');
  });

  it('loads sibling modules recursively for custom elements with spaces in the root file name', async () => {
    const files = new Map<string, string>([
      [
        '/public/elements/Canvas%20Editor.jsx',
        `
          import { value } from "./canvas-editor/constants.js";
          import { getUpperValue } from "./canvas-editor/hooks/useValue.js";

          export default function CanvasEditor() {
            return value + getUpperValue();
          }
        `,
      ],
      [
        '/public/elements/canvas-editor/constants.js',
        `
          import { suffix } from "./shared/suffix.js";
          export const value = "ok-" + suffix;
        `,
      ],
      [
        '/public/elements/canvas-editor/hooks/useValue.js',
        `
          import { value } from "../constants.js";
          export function getUpperValue() {
            return value.toUpperCase();
          }
        `,
      ],
      [
        '/public/elements/canvas-editor/shared/suffix.js',
        'export const suffix = "ready";',
      ],
    ]);

    const fetchModuleSource = vi.fn(async (publicPath: string) => {
      const sourceCode = files.get(publicPath);
      if (!sourceCode) {
        throw new Error(`Unexpected module path: ${publicPath}`);
      }
      return sourceCode;
    });

    const moduleTree = await loadCustomElementModuleTree({
      rootModulePath: 'Canvas Editor.jsx',
      fetchModuleSource,
      baseImports: {},
    });

    expect(fetchModuleSource).toHaveBeenCalledWith(
      '/public/elements/Canvas%20Editor.jsx'
    );
    expect(moduleTree.sourceCode).toContain(
      'import { value } from "./canvas-editor/constants.js";'
    );
    expect(
      (moduleTree.localImports['./canvas-editor/constants.js'] as {
        value: string;
      }).value
    ).toBe('ok-ready');
    expect(
      (
        moduleTree.localImports['./canvas-editor/hooks/useValue.js'] as {
          getUpperValue: () => string;
        }
      ).getUpperValue()
    ).toBe('OK-READY');
  });
});
