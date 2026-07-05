import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const diffSource = readFileSync(
  resolve(
    __dirname,
    "../../../../backend/public/elements/canvas-editor/tracked-changes/diff.js"
  ),
  "utf8"
);
const prosemirrorTextSource = readFileSync(
  resolve(
    __dirname,
    "../../../../backend/public/elements/canvas-editor/prosemirrorText.js"
  ),
  "utf8"
);
const trackedChangesHookSource = readFileSync(
  resolve(
    __dirname,
    "../../../../backend/public/elements/canvas-editor/tracked-changes/useCanvasTrackedChangesDecorations.js"
  ),
  "utf8"
);

function loadDiffModule() {
  const transformedSource = diffSource
    .replace('import { decodeVisibleSpaceRuns } from "../whitespace.js";', "")
    .replace(/export function /g, "function ");
  const executeModule = Function(
    "decodeVisibleSpaceRuns",
    `${transformedSource}
    return {
      buildTrackedChangesDiff,
      markdownToTrackedChangesText,
      normalizeTrackedChangesText,
    };`
  );
  return executeModule((value: unknown) =>
    String(value ?? "").replace(/\u00a0/g, " ")
  ) as {
    buildTrackedChangesDiff: (baseText: string, currentText: string) => {
      insertions: Array<Record<string, unknown>>;
      deletions: Array<Record<string, unknown>>;
    };
    markdownToTrackedChangesText: (value: string) => string;
    normalizeTrackedChangesText: (value: string) => string;
  };
}

function loadProsemirrorTextModule() {
  const transformedSource = prosemirrorTextSource.replace(/export function /g, "function ");
  const executeModule = Function(
    `${transformedSource}
    return {
      getEditorDocumentText,
      getEditorPositionForTextOffset,
      getEditorPositionRangeForTextOffsets,
    };`
  );
  return executeModule() as {
    getEditorDocumentText: (
      editorInstanceRef: unknown,
      options?: { blockSeparator?: string; leafText?: string }
    ) => string;
    getEditorPositionForTextOffset: (
      editorInstanceRef: unknown,
      offset: number,
      options?: { blockSeparator?: string; leafText?: string }
    ) => number | null;
    getEditorPositionRangeForTextOffsets: (
      editorInstanceRef: unknown,
      start: number,
      end: number,
      options?: { blockSeparator?: string; leafText?: string }
    ) => { from: number; to: number } | null;
  };
}

function loadTrackedChangesSyncModule() {
  const transformedSource = trackedChangesHookSource
    .replace('import { useLayoutEffect, useRef } from "react";\n\n', "")
    .replace(
      /import \{\n  buildTrackedChangesDiff,\n  markdownToTrackedChangesText,\n  normalizeTrackedChangesText,\n\} from "\.\/diff\.js";\n/,
      ""
    )
    .replace(
      /import \{\n  getEditorDocumentText,\n  getEditorPositionForTextOffset,\n  getEditorPositionRangeForTextOffsets,\n\} from "\.\.\/prosemirrorText\.js";\n/,
      ""
    )
    .replace(
      "export function syncCanvasTrackedChangesSession",
      "function syncCanvasTrackedChangesSession"
    )
    .replace(
      "export function useCanvasTrackedChangesDecorations",
      "function useCanvasTrackedChangesDecorations"
    );
  const diffModule = loadDiffModule();
  const prosemirrorTextModule = loadProsemirrorTextModule();
  const executeModule = Function(
    "buildTrackedChangesDiff",
    "markdownToTrackedChangesText",
    "normalizeTrackedChangesText",
    "getEditorDocumentText",
    "getEditorPositionForTextOffset",
    "getEditorPositionRangeForTextOffsets",
    "useLayoutEffect",
    "useRef",
    `${transformedSource}
    return {
      syncCanvasTrackedChangesSession,
    };`
  );
  return executeModule(
    diffModule.buildTrackedChangesDiff,
    diffModule.markdownToTrackedChangesText,
    diffModule.normalizeTrackedChangesText,
    prosemirrorTextModule.getEditorDocumentText,
    prosemirrorTextModule.getEditorPositionForTextOffset,
    prosemirrorTextModule.getEditorPositionRangeForTextOffsets,
    () => {},
    () => ({ current: "" })
  ) as {
    syncCanvasTrackedChangesSession: (args: {
      editorInstanceRef: unknown;
      trackedChanges: Record<string, unknown>;
      trackedChangesDecorationsController: {
        clear: () => void;
        hydrate: (payload: Record<string, unknown>) => boolean | undefined;
        resetUndoRedoHistory?: () => void;
        setEnabled: (value: boolean) => void;
      };
    }) => boolean;
  };
}

function buildPlainTextEditorRef(text: string) {
  const plainText = String(text);
  const doc = {
    content: { size: plainText.length + 1 },
    nodeSize: plainText.length + 1,
    textBetween: (_from: number, to: number) =>
      plainText.slice(0, Math.max(0, Math.min(plainText.length, to - 1))),
  };
  return {
    current: {
      wwEditor: {
        view: {
          state: { doc },
        },
      },
    },
  };
}

describe("canvas review tracked changes sync", () => {
  it("rehydrates tracked changes after a programmatic accept path", () => {
    const { syncCanvasTrackedChangesSession } = loadTrackedChangesSyncModule();
    const editorInstanceRef = buildPlainTextEditorRef("Hello new world");
    const trackedChangesDecorationsController = {
      clear: vi.fn(),
      hydrate: vi.fn(() => true),
      resetUndoRedoHistory: vi.fn(),
      setEnabled: vi.fn(),
    };

    const synced = syncCanvasTrackedChangesSession({
      editorInstanceRef,
      trackedChanges: {
        enabled: true,
        baseCheckpointId: "checkpoint-1",
        baseContent: "# Hello old world",
      },
      trackedChangesDecorationsController,
    });

    expect(synced).toBe(true);
    expect(trackedChangesDecorationsController.setEnabled).toHaveBeenNthCalledWith(1, false);
    expect(trackedChangesDecorationsController.clear).toHaveBeenCalledTimes(1);
    expect(trackedChangesDecorationsController.hydrate).toHaveBeenCalledWith({
      insertions: [
        expect.objectContaining({ from: 7, to: 10, changeId: expect.stringContaining("tracked-insert-") }),
      ],
      deletions: [
        expect.objectContaining({
          from: 10,
          to: 13,
          originalText: "old",
          changeId: expect.stringContaining("tracked-delete-"),
        }),
      ],
      textInsertions: [{ position: 10, text: "old" }],
    });
    expect(trackedChangesDecorationsController.resetUndoRedoHistory).toHaveBeenCalledTimes(1);
    expect(trackedChangesDecorationsController.setEnabled).toHaveBeenNthCalledWith(2, true);
  });
});
