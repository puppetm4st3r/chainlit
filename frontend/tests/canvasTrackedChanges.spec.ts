import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const diffSource = readFileSync(
  resolve(
    __dirname,
    '../../../../backend/public/elements/canvas-editor/tracked-changes/diff.js'
  ),
  'utf8'
);
const prosemirrorDecorationsSource = readFileSync(
  resolve(
    __dirname,
    '../../../../backend/public/elements/canvas-editor/tracked-changes/prosemirrorDecorations.js'
  ),
  'utf8'
);
const configSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/config.js'),
  'utf8'
);
const prosemirrorTextSource = readFileSync(
  resolve(__dirname, '../../../../backend/public/elements/canvas-editor/prosemirrorText.js'),
  'utf8'
);

function loadDiffModule() {
  const transformedSource = diffSource
    .replace('import { decodeVisibleSpaceRuns } from "../whitespace.js";', '')
    .replace(/export function /g, 'function ');
  const executeModule = Function(
    'decodeVisibleSpaceRuns',
    `${transformedSource}
    return {
      buildTrackedChangesDiff,
      markdownToTrackedChangesText,
      normalizeTrackedChangesText,
    };`
  );
  return executeModule((value: unknown) => String(value ?? '').replace(/\u00a0/g, ' ')) as {
    buildTrackedChangesDiff: (baseText: string, currentText: string) => {
      insertions: Array<Record<string, unknown>>;
      deletions: Array<Record<string, unknown>>;
    };
    markdownToTrackedChangesText: (value: string) => string;
    normalizeTrackedChangesText: (value: string) => string;
  };
}

function loadProsemirrorDecorationsModule() {
  const transformedSource = prosemirrorDecorationsSource
    .replace(
      'export function createCanvasTrackedChangesDecorationController',
      'function createCanvasTrackedChangesDecorationController'
    )
    .replace(
      'export const TRACKED_CHANGES_INTERNAL_META_KEY = TRACKED_CHANGES_INTERNAL_META;',
      'const TRACKED_CHANGES_INTERNAL_META_KEY = TRACKED_CHANGES_INTERNAL_META;'
    );
  const executeModule = Function(
    `${transformedSource}
    return {
      createCanvasTrackedChangesDecorationController,
      TRACKED_CHANGES_INTERNAL_META_KEY,
    };`
  );
  return executeModule() as {
    createCanvasTrackedChangesDecorationController: () => {
      hydrate: (payload: {
        insertions?: Array<Record<string, unknown>>;
        deletions?: Array<Record<string, unknown>>;
        textInsertions?: Array<{ position: number; text: string }>;
      }) => boolean | undefined;
      clear: () => void;
      setEnabled: (value: boolean) => void;
      isEnabled: () => boolean;
      suspendWhile: <T>(callback: () => T) => T;
      willRevert: (transaction: unknown, state: unknown) => boolean;
      restoreDeletion: (changeId: string) => boolean;
      recordDocHistoryPush: () => void;
      resetUndoRedoHistory: () => void;
      canUndo: () => boolean;
      canRedo: () => boolean;
      undo: () => 'plugin' | 'doc' | 'noop' | undefined;
      redo: () => 'plugin' | 'doc' | 'noop' | undefined;
      getCleanMarkdown: (editorInstance: unknown) => string;
      toastUiPlugin: (context: unknown) => Record<string, unknown>;
    };
    TRACKED_CHANGES_INTERNAL_META_KEY: string;
  };
}

function loadProsemirrorTextModule() {
  const transformedSource = prosemirrorTextSource.replace(/export function /g, 'function ');
  const executeModule = Function(
    `${transformedSource}\nreturn {
      getEditorView,
      getEditorDocumentText,
      findEditorPositionForTextOffset,
      getEditorPositionRangeForTextOffsets,
      getEditorPositionForTextOffset,
    };`
  );
  return executeModule() as {
    findEditorPositionForTextOffset: (
      doc: unknown,
      offset: number,
      options?: { blockSeparator?: string; leafText?: string }
    ) => number | null;
  };
}

function loadConfigModule() {
  const transformedSource = configSource
    .replace('export function extractCanvasWidgetConfig', 'function extractCanvasWidgetConfig')
    .replace('export function mergeCanvasWidgetConfig', 'function mergeCanvasWidgetConfig');
  const executeModule = Function(
    `${transformedSource}\nreturn { extractCanvasWidgetConfig, mergeCanvasWidgetConfig };`
  );
  return executeModule() as {
    extractCanvasWidgetConfig: (rawProps: Record<string, unknown>) => Record<string, unknown>;
  };
}

interface MockMapping {
  map: (pos: number, bias?: number) => number;
  slice: () => MockMapping;
  invert: () => MockMapping;
}

function identityMapping(): MockMapping {
  const m: MockMapping = {
    map: (pos: number) => pos,
    slice: () => m,
    invert: () => m,
  };
  return m;
}

function shiftMapping(at: number, delta: number): MockMapping {
  const m: MockMapping = {
    map(pos: number, bias?: number) {
      if (pos < at) return pos;
      if (pos === at) {
        // ProseMirror bias semantics: +1 returns the position AFTER the
        // inserted slice (extend forward); -1 keeps the position BEFORE the
        // inserted slice (do not extend).
        return bias === -1 ? pos : pos + delta;
      }
      return pos + delta;
    },
    slice: () => m,
    invert: () => m,
  };
  return m;
}

function makeTransaction({
  mapping = identityMapping(),
  meta = {},
  docChanged = true,
}: {
  mapping?: MockMapping;
  meta?: Record<string, unknown>;
  docChanged?: boolean;
} = {}) {
  const metaStore: Record<string, unknown> = { ...meta };
  return {
    mapping,
    docChanged,
    steps: [] as unknown[],
    docs: [] as unknown[],
    getMeta(key: string) {
      return metaStore[key];
    },
    setMeta(key: string, value: unknown) {
      metaStore[key] = value;
      return this;
    },
  };
}

function createMockPmEnv() {
  const inline = vi.fn((from: number, to: number, attrs: Record<string, unknown>, spec: unknown) => ({
    kind: 'inline',
    from,
    to,
    attrs,
    spec,
  }));
  const DecorationSet = {
    empty: { decorations: [] as unknown[] },
    create: vi.fn((doc: unknown, decorations: unknown[]) => ({ doc, decorations })),
  };
  class PluginKey {
    constructor(public name: string) {}
    getState(state: Record<string, unknown>) {
      return state[this.name];
    }
  }
  class Plugin {
    public spec: Record<string, unknown>;
    constructor(spec: Record<string, unknown>) {
      this.spec = spec;
    }
  }
  return {
    pmState: { Plugin, PluginKey },
    pmView: { Decoration: { inline }, DecorationSet },
    inline,
    DecorationSet,
    PluginKey,
  };
}

interface BoundPlugin {
  controller: ReturnType<ReturnType<typeof loadProsemirrorDecorationsModule>['createCanvasTrackedChangesDecorationController']>;
  env: ReturnType<typeof createMockPmEnv>;
  plugin: { spec: Record<string, any> };
  pluginKey: any;
}

function buildPluginUnderTest(): BoundPlugin {
  const { createCanvasTrackedChangesDecorationController } = loadProsemirrorDecorationsModule();
  const controller = createCanvasTrackedChangesDecorationController();
  const env = createMockPmEnv();
  const pluginInfo = controller.toastUiPlugin(env) as { wysiwygPlugins: Array<() => any> };
  const plugin = pluginInfo.wysiwygPlugins[0]();
  const pluginKey = plugin.spec.key;
  return { controller, env, plugin, pluginKey };
}

function readPluginState(plugin: { spec: Record<string, any> }) {
  return plugin.spec.state.init({}, { doc: { content: { size: 0 } } });
}

describe('canvas tracked changes config', () => {
  it('normalizes tracked-changes baseline fields from widget props', () => {
    const { extractCanvasWidgetConfig } = loadConfigModule();
    const config = extractCanvasWidgetConfig({
      trackedChanges: {
        available: true,
        enabled: true,
        activeSessionId: 'session-1',
        checkpointCount: 1,
        baseCheckpointId: 'checkpoint-1',
        baseContent: '# Baseline',
      },
    });

    expect(config.trackedChanges).toMatchObject({
      available: true,
      enabled: true,
      activeSessionId: 'session-1',
      checkpointCount: 1,
      baseCheckpointId: 'checkpoint-1',
      baseContent: '# Baseline',
    });
  });
});

describe('canvas tracked changes diff (hydration source)', () => {
  it('builds insertion and deletion ranges without mixing deleted text into current ranges', () => {
    const { buildTrackedChangesDiff, markdownToTrackedChangesText } = loadDiffModule();
    const baseText = markdownToTrackedChangesText('# Hello old world');
    const diff = buildTrackedChangesDiff(baseText, 'Hello new world');

    expect(diff.insertions).toEqual([
      expect.objectContaining({ start: 6, end: 9, text: 'new' }),
    ]);
    expect(diff.deletions).toEqual([
      expect.objectContaining({ position: 9, text: 'old' }),
    ]);
    expect(diff.insertions.map((range) => range.text)).not.toContain('old');
  });

  it('builds a pure deletion segment at the surviving text boundary', () => {
    const { buildTrackedChangesDiff, markdownToTrackedChangesText } = loadDiffModule();
    const diff = buildTrackedChangesDiff(
      markdownToTrackedChangesText('Hello deleted world'),
      markdownToTrackedChangesText('Hello world')
    );

    expect(diff.insertions).toEqual([]);
    expect(diff.deletions).toEqual([
      expect.objectContaining({ position: 5, text: 'deleted' }),
    ]);
  });

  it('refines token-level replaces at character level so single-letter edits do not strike whole words', () => {
    const { buildTrackedChangesDiff } = loadDiffModule();
    const diff1 = buildTrackedChangesDiff('Hola palabra mundo', 'Hola palbra mundo');
    expect(diff1.insertions).toEqual([]);
    expect(diff1.deletions).toEqual([expect.objectContaining({ text: 'a' })]);

    const diff2 = buildTrackedChangesDiff('Hola antigua mundo', 'Hola antiguus mundo');
    expect(diff2.insertions.map((s) => s.text)).toEqual(['us']);
    expect(diff2.deletions.map((s) => s.text)).toEqual(['a']);

    const diff3 = buildTrackedChangesDiff('Hola palabra mundo', 'Hola palXabra mundo');
    expect(diff3.deletions).toEqual([]);
    expect(diff3.insertions).toEqual([expect.objectContaining({ text: 'X' })]);
  });

  it('flattens markdown baselines so block boundaries align with the editor PM-text view', () => {
    const { markdownToTrackedChangesText } = loadDiffModule();
    expect(markdownToTrackedChangesText('# Title\n\nHello world')).toBe('Title\nHello world');
    expect(markdownToTrackedChangesText('- a\n- b')).toBe('a\nb');
    expect(markdownToTrackedChangesText('Hola\n\n\n\nMundo')).toBe('Hola\nMundo');
  });

  it('flattens markdown tables so cells align with the WYSIWYG PM-text view', () => {
    const { markdownToTrackedChangesText } = loadDiffModule();
    expect(
      markdownToTrackedChangesText('| H1 | H2 |\n| --- | --- |\n| a | b |\n| c | d |')
    ).toBe('H1\nH2\na\nb\nc\nd');
  });

  it('preserves escaped literal markdown punctuation when stripping formatting markers', () => {
    const { markdownToTrackedChangesText } = loadDiffModule();
    expect(markdownToTrackedChangesText('**Segundo\\***: texto')).toBe('Segundo*: texto');
    expect(markdownToTrackedChangesText('\\* no es lista')).toBe('* no es lista');
    expect(markdownToTrackedChangesText('\\# no es titulo')).toBe('# no es titulo');
  });

  it('maps tracked-changes offsets to PM positions using a block separator that matches the diff input', () => {
    const { findEditorPositionForTextOffset } = loadProsemirrorTextModule();
    const docTextLengthAtPosition = (to: number): number => {
      if (to <= 1) return 0;
      if (to <= 6) return to - 1;
      if (to === 7) return 5;
      if (to === 8) return 6;
      if (to <= 13) return 6 + (to - 8);
      return 11;
    };
    const doc = {
      content: { size: 14 },
      nodeSize: 14,
      textBetween: (_from: number, to: number, blockSeparator: string) => {
        if (blockSeparator !== '\n') {
          throw new Error(
            `tracked-changes position lookup must use blockSeparator="\\n", got ${JSON.stringify(blockSeparator)}`
          );
        }
        return ' '.repeat(docTextLengthAtPosition(to));
      },
    };

    expect(findEditorPositionForTextOffset(doc, 0, { blockSeparator: '\n' })).toBe(1);
    expect(findEditorPositionForTextOffset(doc, 5, { blockSeparator: '\n' })).toBe(6);
    expect(findEditorPositionForTextOffset(doc, 6, { blockSeparator: '\n' })).toBe(8);
    expect(findEditorPositionForTextOffset(doc, 7, { blockSeparator: '\n' })).toBe(9);
  });
});

describe('canvas tracked changes plugin state', () => {
  it('starts empty', () => {
    const { plugin } = buildPluginUnderTest();
    const state = readPluginState(plugin);
    expect(state.insertions.size).toBe(0);
    expect(state.deletions.size).toBe(0);
  });

  it('hydrate meta op fills insertions and deletions', () => {
    const { plugin } = buildPluginUnderTest();
    const initial = readPluginState(plugin);
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const tx = makeTransaction({
      meta: {
        [opsKey]: [
          {
            type: 'hydrate',
            insertions: [{ changeId: 'i-1', from: 5, to: 9 }],
            deletions: [
              { changeId: 'd-1', from: 9, to: 12, originalText: 'old' },
            ],
          },
        ],
      },
    });
    const next = plugin.spec.state.apply(tx, initial);
    expect(next.insertions.size).toBe(1);
    expect(next.deletions.size).toBe(1);
    expect(next.insertions.get('i-1')).toEqual({ changeId: 'i-1', from: 5, to: 9 });
    expect(next.deletions.get('d-1')).toEqual({
      changeId: 'd-1',
      from: 9,
      to: 12,
      originalText: 'old',
    });
  });

  it('register-deletion meta op adds a tombstone range', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const next = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'register-deletion',
              changeId: 'd-1',
              from: 1,
              to: 4,
              originalText: 'foo',
            },
          ],
        },
      }),
      readPluginState(plugin)
    );
    expect(next.deletions.get('d-1')).toMatchObject({ from: 1, to: 4, originalText: 'foo' });
  });

  it('register-deletion merges adjacent forward deletes into one restorable range', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const next = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            { type: 'register-deletion', changeId: 'd-1', from: 1, to: 2, originalText: 'f' },
            { type: 'register-deletion', changeId: 'd-2', from: 2, to: 3, originalText: 'o' },
            { type: 'register-deletion', changeId: 'd-3', from: 3, to: 4, originalText: 'o' },
          ],
        },
      }),
      readPluginState(plugin)
    );

    expect(next.deletions.size).toBe(1);
    expect(next.deletions.get('d-1')).toMatchObject({
      changeId: 'd-1',
      from: 1,
      to: 4,
      originalText: 'foo',
    });
  });

  it('register-deletion merges adjacent backward deletes in document order', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const next = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            { type: 'register-deletion', changeId: 'd-1', from: 3, to: 4, originalText: 'o' },
            { type: 'register-deletion', changeId: 'd-2', from: 2, to: 3, originalText: 'o' },
            { type: 'register-deletion', changeId: 'd-3', from: 1, to: 2, originalText: 'f' },
          ],
        },
      }),
      readPluginState(plugin)
    );

    expect(next.deletions.size).toBe(1);
    expect(next.deletions.get('d-3')).toMatchObject({
      changeId: 'd-3',
      from: 1,
      to: 4,
      originalText: 'foo',
    });
  });

  it('register-insertion meta op adds an insertion range', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const next = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            { type: 'register-insertion', changeId: 'i-1', from: 2, to: 7 },
          ],
        },
      }),
      readPluginState(plugin)
    );
    expect(next.insertions.get('i-1')).toMatchObject({ from: 2, to: 7 });
  });

  it('restore-deletion meta op removes the matching deletion', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const hydrated = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'hydrate',
              insertions: [],
              deletions: [{ changeId: 'd-1', from: 0, to: 3, originalText: 'old' }],
            },
          ],
        },
      }),
      readPluginState(plugin)
    );
    expect(hydrated.deletions.size).toBe(1);

    const restored = plugin.spec.state.apply(
      makeTransaction({
        meta: { [opsKey]: [{ type: 'restore-deletion', changeId: 'd-1' }] },
      }),
      hydrated
    );
    expect(restored.deletions.size).toBe(0);
  });

  it('clear meta op empties the entire state', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const hydrated = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'hydrate',
              insertions: [{ changeId: 'i-1', from: 1, to: 2 }],
              deletions: [{ changeId: 'd-1', from: 2, to: 3, originalText: 'x' }],
            },
          ],
        },
      }),
      readPluginState(plugin)
    );
    const cleared = plugin.spec.state.apply(
      makeTransaction({ meta: { [opsKey]: [{ type: 'clear' }] } }),
      hydrated
    );
    expect(cleared.insertions.size).toBe(0);
    expect(cleared.deletions.size).toBe(0);
  });

  it('range mapping shifts insertion and deletion ranges through transactions', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const initial = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'hydrate',
              insertions: [{ changeId: 'i-1', from: 10, to: 14 }],
              deletions: [{ changeId: 'd-1', from: 20, to: 25, originalText: 'tombs' }],
            },
          ],
        },
      }),
      readPluginState(plugin)
    );

    // Insertar 3 caracteres en posicion 5: todo lo que este >= 5 se desplaza +3.
    const shifted = plugin.spec.state.apply(
      makeTransaction({ mapping: shiftMapping(5, 3) }),
      initial
    );
    expect(shifted.insertions.get('i-1')).toMatchObject({ from: 13, to: 17 });
    expect(shifted.deletions.get('d-1')).toMatchObject({ from: 23, to: 28 });

    // Insertar antes de la insertion pero despues de la deletion; solo afecta a la insertion.
    const shifted2 = plugin.spec.state.apply(
      makeTransaction({ mapping: shiftMapping(11, 5) }),
      initial
    );
    expect(shifted2.insertions.get('i-1')).toMatchObject({ from: 10, to: 19 });
    expect(shifted2.deletions.get('d-1')).toMatchObject({ from: 25, to: 30 });
  });

  it('insertions extend forward when content is appended at their `to` boundary', () => {
    // Bug: with bias `to=-1` typing exactly at the insertion's end produced a
    // separate range. With `inclusiveEnd: true` on the decoration the visual
    // already extends; the underlying state must follow.
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const initial = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            { type: 'hydrate', insertions: [{ changeId: 'i-1', from: 10, to: 14 }], deletions: [] },
          ],
        },
      }),
      readPluginState(plugin)
    );

    const extended = plugin.spec.state.apply(
      makeTransaction({ mapping: shiftMapping(14, 2) }),
      initial
    );
    expect(extended.insertions.get('i-1')).toMatchObject({ from: 10, to: 16 });
  });

  it('deletions stay anchored when content is appended at their `to` boundary', () => {
    // Deletions use bias `to=-1` to keep adjacent typing OUTSIDE the
    // strikethrough region (matches `inclusiveEnd: false`).
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const initial = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'hydrate',
              insertions: [],
              deletions: [{ changeId: 'd-1', from: 5, to: 11, originalText: 'viejo ' }],
            },
          ],
        },
      }),
      readPluginState(plugin)
    );

    const trailing = plugin.spec.state.apply(
      makeTransaction({ mapping: shiftMapping(11, 1) }),
      initial
    );
    expect(trailing.deletions.get('d-1')).toMatchObject({ from: 5, to: 11 });
  });
});

describe('canvas tracked changes appendTransaction gating', () => {
  function makeStateLike(plugin: { spec: Record<string, any> }, ranges: any) {
    return {
      doc: { content: { size: 50 } },
      tr: {
        setMeta() {
          return this;
        },
        getMeta() {
          return undefined;
        },
        insertText() {
          return this;
        },
        replaceWith() {
          return this;
        },
        mapping: identityMapping(),
      },
      [plugin.spec.key.name]: ranges,
    };
  }

  it('appendTransaction is a no-op while tracking is disabled (the default)', () => {
    const { controller, plugin } = buildPluginUnderTest();
    const ranges = readPluginState(plugin);
    const state = makeStateLike(plugin, ranges);

    expect(controller.isEnabled()).toBe(false);
    expect(plugin.spec.appendTransaction([makeTransaction()], state, state)).toBeNull();
  });

  it('appendTransaction is a no-op while suspendWhile() is on the stack', () => {
    const { controller, plugin } = buildPluginUnderTest();
    controller.setEnabled(true);
    const ranges = readPluginState(plugin);
    const state = makeStateLike(plugin, ranges);

    let observedDuring: unknown = 'untouched';
    controller.suspendWhile(() => {
      observedDuring = plugin.spec.appendTransaction([makeTransaction()], state, state);
    });
    expect(observedDuring).toBeNull();
    // Tracking flag itself is preserved; suspension only blocks interception.
    expect(controller.isEnabled()).toBe(true);
  });

  it('suspendWhile counts nested invocations correctly', () => {
    const { controller } = buildPluginUnderTest();
    controller.setEnabled(true);
    let outerEntered = false;
    let innerEntered = false;
    controller.suspendWhile(() => {
      outerEntered = true;
      controller.suspendWhile(() => {
        innerEntered = true;
      });
    });
    expect(outerEntered).toBe(true);
    expect(innerEntered).toBe(true);
    expect(controller.isEnabled()).toBe(true);
  });

  function makeFakeTextSelectionCtor() {
    class FakeTextSelection {
      from: number;
      anchor: number;
      head: number;
      to: number;
      constructor(from: number, to: number) {
        this.from = from;
        this.anchor = from;
        this.head = to;
        this.to = to;
      }
      static create(_doc: any, from: number, to?: number) {
        return new FakeTextSelection(from, to ?? from);
      }
    }
    return FakeTextSelection;
  }

  function makeFakeTrCapturer(initialDoc: unknown) {
    const inverseStepsApplied: Array<unknown> = [];
    let setSelectionArg: any = null;
    let scrollIntoViewCalls = 0;
    const tr: any = {
      doc: initialDoc,
      mapping: identityMapping(),
      setMeta: vi.fn(function setMeta() {
        return tr;
      }),
      getMeta: () => undefined,
      maybeStep(step: unknown) {
        inverseStepsApplied.push(step);
        return { failed: null };
      },
      step(step: unknown) {
        inverseStepsApplied.push(step);
        return tr;
      },
      setSelection(selection: unknown) {
        setSelectionArg = selection;
        return tr;
      },
      scrollIntoView() {
        scrollIntoViewCalls += 1;
        return tr;
      },
      replaceWith() {
        // Should never be hit anymore; the revert path uses inverse steps.
        throw new Error('tr.replaceWith must not be used to revert tracked changes');
      },
    };
    return {
      tr,
      get inverseStepsApplied() {
        return inverseStepsApplied;
      },
      get setSelectionArg() {
        return setSelectionArg;
      },
      get scrollIntoViewCalls() {
        return scrollIntoViewCalls;
      },
    };
  }

  it('reverts insertions strictly inside a deletion via inverse steps and restores the caret', () => {
    // This is the key invariant for "no debiese dejar insertar dentro de una
    // palabra tachada ni borrar, solo correr el cursor". The revert must use
    // inverse steps (NOT a global replaceWith) so the existing strikethrough
    // range survives, and the cursor must be pinned to where the user came
    // from so the editor does not feel "broken".
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);

    let pluginState: any = readPluginState(plugin);
    pluginState = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          'canvas-tracked-changes-decorations-ops': [
            {
              type: 'hydrate',
              insertions: [],
              deletions: [{ changeId: 'd-1', from: 5, to: 11, originalText: 'viejo ' }],
            },
          ],
        },
      }),
      pluginState
    );

    const oldDoc = { content: { size: 16 } };
    const newDoc = { content: { size: 17 } };

    const inverseSentinel = { __inverse: 'insert-X' };
    const stepInvert = vi.fn(() => inverseSentinel);
    const userTx = {
      mapping: identityMapping(),
      docChanged: true,
      steps: [
        {
          from: 8,
          to: 8,
          slice: { size: 1, content: { size: 1, textBetween: () => 'X' } },
          apply: () => true,
          invert: stepInvert,
        },
      ],
      docs: [oldDoc],
      getMeta: () => undefined,
      setMeta() {
        return this;
      },
    };

    const FakeTextSelection = makeFakeTextSelectionCtor();
    const oldSelection = new FakeTextSelection(8, 8);

    const oldState = {
      doc: oldDoc,
      selection: oldSelection,
      [pluginKey.name]: pluginState,
    };

    const capturer = makeFakeTrCapturer(newDoc);
    const newState = {
      doc: newDoc,
      tr: capturer.tr,
      selection: oldSelection,
      [pluginKey.name]: pluginState,
    };

    const result = plugin.spec.appendTransaction([userTx], oldState, newState);
    expect(result).toBe(capturer.tr);
    // The user step's inverse must be the one applied to revert.
    expect(stepInvert).toHaveBeenCalledWith(oldDoc);
    expect(capturer.inverseStepsApplied).toEqual([inverseSentinel]);
    // Caret pinned to the original cursor position inside the strikethrough.
    expect(capturer.setSelectionArg).toBeInstanceOf(FakeTextSelection);
    expect(capturer.setSelectionArg?.from).toBe(8);
    expect(capturer.setSelectionArg?.to).toBe(8);
    expect(capturer.scrollIntoViewCalls).toBeGreaterThan(0);
  });

  it('on a clean delete (revert-clean) reverts via inverse steps and pins the caret to selection.from', () => {
    // Repro for "cuando tacho se pierde el foco del cursor en el editor":
    // a clean delete is reverted into a tracked deletion. The cursor must
    // collapse to the start of the original selection so PM keeps focus.
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);

    const oldDoc = {
      content: { size: 16 },
      textBetween: (from: number, to: number) => {
        if (from === 5 && to === 11) return 'viejo ';
        return '';
      },
    };
    const newDoc = { content: { size: 10 } };

    const inverseSentinel = { __inverse: 'reinsert-viejo' };
    const stepInvert = vi.fn(() => inverseSentinel);
    const userTx = {
      mapping: identityMapping(),
      docChanged: true,
      steps: [
        {
          from: 5,
          to: 11,
          slice: { size: 0, content: { size: 0, textBetween: () => '' } },
          apply: () => true,
          invert: stepInvert,
        },
      ],
      docs: [oldDoc],
      getMeta: () => undefined,
      setMeta() {
        return this;
      },
    };

    const FakeTextSelection = makeFakeTextSelectionCtor();
    const oldSelection = new FakeTextSelection(5, 11); // user had "viejo " selected

    const oldState = {
      doc: oldDoc,
      selection: oldSelection,
      [pluginKey.name]: readPluginState(plugin),
    };

    const capturer = makeFakeTrCapturer(newDoc);
    const newState = {
      doc: newDoc,
      tr: capturer.tr,
      selection: oldSelection,
      [pluginKey.name]: readPluginState(plugin),
    };

    const result = plugin.spec.appendTransaction([userTx], oldState, newState);
    expect(result).toBe(capturer.tr);
    expect(stepInvert).toHaveBeenCalledWith(oldDoc);
    expect(capturer.inverseStepsApplied).toEqual([inverseSentinel]);
    // Cursor MUST collapse to selection.from (5), not selection.to (11) and
    // not to whatever PM's mapping landed on after the inverse step.
    expect(capturer.setSelectionArg).toBeInstanceOf(FakeTextSelection);
    expect(capturer.setSelectionArg?.from).toBe(5);
    expect(capturer.setSelectionArg?.to).toBe(5);
  });

  it('on a collapsed Delete, places the caret after the new deletion mark so repeated Delete keeps striking through', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);

    const oldDoc = {
      content: { size: 10 },
      textBetween: (from: number, to: number) => {
        if (from === 5 && to === 6) return 'a';
        return '';
      },
    };
    const newDoc = { content: { size: 9 } };
    const inverseSentinel = { __inverse: 'reinsert-a' };
    const stepInvert = vi.fn(() => inverseSentinel);
    const userTx = {
      mapping: identityMapping(),
      docChanged: true,
      steps: [
        {
          from: 5,
          to: 6,
          slice: { size: 0, content: { size: 0, textBetween: () => '' } },
          apply: () => true,
          invert: stepInvert,
        },
      ],
      docs: [oldDoc],
      getMeta: () => undefined,
      setMeta() {
        return this;
      },
    };
    const FakeTextSelection = makeFakeTextSelectionCtor();
    const oldSelection = new FakeTextSelection(5, 5);
    const capturer = makeFakeTrCapturer(newDoc);

    plugin.spec.appendTransaction(
      [userTx],
      {
        doc: oldDoc,
        selection: oldSelection,
        [pluginKey.name]: readPluginState(plugin),
      },
      {
        doc: newDoc,
        tr: capturer.tr,
        selection: oldSelection,
        [pluginKey.name]: readPluginState(plugin),
      }
    );

    expect(capturer.setSelectionArg).toBeInstanceOf(FakeTextSelection);
    expect(capturer.setSelectionArg?.from).toBe(6);
    expect(capturer.setSelectionArg?.to).toBe(6);
  });

  it('on a collapsed Backspace, places the caret before the new deletion mark so repeated Backspace keeps striking through', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);

    const oldDoc = {
      content: { size: 10 },
      textBetween: (from: number, to: number) => {
        if (from === 4 && to === 5) return 'a';
        return '';
      },
    };
    const newDoc = { content: { size: 9 } };
    const inverseSentinel = { __inverse: 'reinsert-a' };
    const stepInvert = vi.fn(() => inverseSentinel);
    const userTx = {
      mapping: identityMapping(),
      docChanged: true,
      steps: [
        {
          from: 4,
          to: 5,
          slice: { size: 0, content: { size: 0, textBetween: () => '' } },
          apply: () => true,
          invert: stepInvert,
        },
      ],
      docs: [oldDoc],
      getMeta: () => undefined,
      setMeta() {
        return this;
      },
    };
    const FakeTextSelection = makeFakeTextSelectionCtor();
    const oldSelection = new FakeTextSelection(5, 5);
    const capturer = makeFakeTrCapturer(newDoc);

    plugin.spec.appendTransaction(
      [userTx],
      {
        doc: oldDoc,
        selection: oldSelection,
        [pluginKey.name]: readPluginState(plugin),
      },
      {
        doc: newDoc,
        tr: capturer.tr,
        selection: oldSelection,
        [pluginKey.name]: readPluginState(plugin),
      }
    );

    expect(capturer.setSelectionArg).toBeInstanceOf(FakeTextSelection);
    expect(capturer.setSelectionArg?.from).toBe(4);
    expect(capturer.setSelectionArg?.to).toBe(4);
  });

  it('reverts using inverse steps in REVERSE order (multi-step user tx)', () => {
    // PM steps must be inverted last-to-first to round-trip through the
    // intermediate documents. This guards against regressions in case we
    // accidentally invert in source order.
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);

    // Each step deletes exactly one (clean) character: returning a non-empty
    // textBetween here is what makes collectEditRecords classify the step as
    // a clean delete and trigger a revert.
    const oldDoc = {
      content: { size: 20 },
      textBetween: () => 'a',
    };
    const docAfterStep0 = { content: { size: 19 }, textBetween: () => 'b' };
    const newDoc = { content: { size: 18 }, textBetween: () => '' };

    const inverseStep0 = { __inverse: 'inv-0' };
    const inverseStep1 = { __inverse: 'inv-1' };
    const step0 = {
      from: 0,
      to: 1,
      slice: { size: 0, content: { size: 0, textBetween: () => '' } },
      apply: () => true,
      invert: vi.fn(() => inverseStep0),
    };
    const step1 = {
      from: 5,
      to: 6,
      slice: { size: 0, content: { size: 0, textBetween: () => '' } },
      apply: () => true,
      invert: vi.fn(() => inverseStep1),
    };
    const userTx = {
      mapping: identityMapping(),
      docChanged: true,
      steps: [step0, step1],
      docs: [oldDoc, docAfterStep0],
      getMeta: () => undefined,
      setMeta() {
        return this;
      },
    };

    const FakeTextSelection = makeFakeTextSelectionCtor();
    const oldSelection = new FakeTextSelection(0, 6);

    const capturer = makeFakeTrCapturer(newDoc);
    const oldState = {
      doc: oldDoc,
      selection: oldSelection,
      [pluginKey.name]: readPluginState(plugin),
    };
    const newState = {
      doc: newDoc,
      tr: capturer.tr,
      selection: oldSelection,
      [pluginKey.name]: readPluginState(plugin),
    };

    plugin.spec.appendTransaction([userTx], oldState, newState);
    // The last user step (step1) must be inverted FIRST against docAfterStep0,
    // and then step0 inverted against oldDoc.
    expect(step1.invert).toHaveBeenCalledWith(docAfterStep0);
    expect(step0.invert).toHaveBeenCalledWith(oldDoc);
    expect(capturer.inverseStepsApplied).toEqual([inverseStep1, inverseStep0]);
  });
});

describe('canvas tracked changes willRevert (history exclusion classifier)', () => {
  // The editor view's `dispatch` override calls `willRevert(tr, state)` BEFORE
  // running the user's transaction, and marks it `addToHistory: false` when the
  // plugin is going to revert it inside `appendTransaction`. This keeps the
  // user's tr out of the prosemirror-history stack so a later Ctrl+Z does not
  // re-apply its inverse on top of the already-restored document. These tests
  // pin the contract so the dispatch-side and the appendTransaction-side stay
  // in agreement.
  function makeStateWithPluginRanges(
    plugin: { spec: Record<string, any> },
    pluginKey: any,
    ops: Array<Record<string, unknown>>,
    docSize = 64
  ) {
    let pluginState: any = readPluginState(plugin);
    if (ops.length > 0) {
      pluginState = plugin.spec.state.apply(
        makeTransaction({ meta: { 'canvas-tracked-changes-decorations-ops': ops } }),
        pluginState
      );
    }
    return {
      doc: {
        content: { size: docSize },
        textBetween: (from: number, to: number) =>
          // Non-empty text so `collectEditRecords` classifies deletes as such.
          'x'.repeat(Math.max(0, to - from)),
      },
      [pluginKey.name]: pluginState,
    };
  }

  function makeUserTx({
    from,
    to,
    sliceSize = 0,
    sliceText = '',
  }: {
    from: number;
    to: number;
    sliceSize?: number;
    sliceText?: string;
  }) {
    return {
      mapping: identityMapping(),
      docChanged: true,
      steps: [
        {
          from,
          to,
          slice: {
            size: sliceSize,
            content: { size: sliceSize, textBetween: () => sliceText },
          },
          apply: () => true,
          invert: () => ({ __inverse: true }),
        },
      ],
      docs: [
        {
          content: { size: 64 },
          textBetween: (a: number, b: number) => 'x'.repeat(Math.max(0, b - a)),
        },
      ],
      getMeta: () => undefined,
      setMeta() {
        return this;
      },
    };
  }

  it('returns false when tracking is disabled (default)', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    const state = makeStateWithPluginRanges(plugin, pluginKey, []);
    const userTx = makeUserTx({ from: 5, to: 11 });
    expect(controller.isEnabled()).toBe(false);
    expect(controller.willRevert(userTx, state)).toBe(false);
  });

  it('returns false while suspendWhile() is on the stack', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, []);
    const userTx = makeUserTx({ from: 5, to: 11 });
    let observedDuring: boolean | null = null;
    controller.suspendWhile(() => {
      observedDuring = controller.willRevert(userTx, state);
    });
    expect(observedDuring).toBe(false);
  });

  it('returns true for a clean delete on plain text (revert-clean)', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, []);
    const userTx = makeUserTx({ from: 5, to: 11 });
    expect(controller.willRevert(userTx, state)).toBe(true);
  });

  it('returns true for a delete inside an existing strikethrough (revert-deletion-edit)', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, [
      {
        type: 'hydrate',
        insertions: [],
        deletions: [{ changeId: 'd-1', from: 5, to: 11, originalText: 'viejo ' }],
      },
    ]);
    const userTx = makeUserTx({ from: 6, to: 9 });
    expect(controller.willRevert(userTx, state)).toBe(true);
  });

  it('returns true for an insert strictly inside a strikethrough (revert-insert-inside-deletion)', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, [
      {
        type: 'hydrate',
        insertions: [],
        deletions: [{ changeId: 'd-1', from: 5, to: 11, originalText: 'viejo ' }],
      },
    ]);
    const userTx = makeUserTx({ from: 8, to: 8, sliceSize: 1, sliceText: 'X' });
    expect(controller.willRevert(userTx, state)).toBe(true);
  });

  it('returns false for a clean insertion on plain text (no revert needed)', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, []);
    const userTx = makeUserTx({ from: 7, to: 7, sliceSize: 1, sliceText: 'a' });
    expect(controller.willRevert(userTx, state)).toBe(false);
  });

  it('returns false for an edit inside an existing insertion mark (mapping handles it)', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, [
      {
        type: 'hydrate',
        insertions: [{ changeId: 'i-1', from: 5, to: 11 }],
        deletions: [],
      },
    ]);
    // Delete inside the insertion → mapping shrinks it, no revert.
    const deleteInsideInsertion = makeUserTx({ from: 6, to: 9 });
    expect(controller.willRevert(deleteInsideInsertion, state)).toBe(false);
    // Type more characters at the boundary of the insertion → mapping extends.
    const typingAtBoundary = makeUserTx({
      from: 11,
      to: 11,
      sliceSize: 1,
      sliceText: 'a',
    });
    expect(controller.willRevert(typingAtBoundary, state)).toBe(false);
  });

  it('returns false on transactions without doc changes', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, []);
    const noopTx = {
      ...makeUserTx({ from: 5, to: 5 }),
      docChanged: false,
    };
    expect(controller.willRevert(noopTx, state)).toBe(false);
  });

  it('returns false on internal plugin transactions (avoids re-classifying our own contra-tx)', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);
    const state = makeStateWithPluginRanges(plugin, pluginKey, []);
    const internalTx = {
      ...makeUserTx({ from: 5, to: 11 }),
      getMeta: (key: string) =>
        key === 'canvas-tracked-changes-internal' ? true : undefined,
    };
    expect(controller.willRevert(internalTx, state)).toBe(false);
  });

  it('agrees with appendTransaction: when willRevert is true, appendTransaction does revert', () => {
    // This is the cross-check: dispatch-side and appendTransaction-side must
    // agree on the classification, otherwise the user's tr could be kept in
    // history while the plugin still reverts it (or vice versa).
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    controller.setEnabled(true);

    const oldDoc = {
      content: { size: 16 },
      textBetween: (from: number, to: number) =>
        from === 5 && to === 11 ? 'viejo ' : '',
    };
    const newDoc = { content: { size: 10 } };
    const inverseSentinel = { __inverse: 'reinsert' };
    const userTx = {
      mapping: identityMapping(),
      docChanged: true,
      steps: [
        {
          from: 5,
          to: 11,
          slice: { size: 0, content: { size: 0, textBetween: () => '' } },
          apply: () => true,
          invert: () => inverseSentinel,
        },
      ],
      docs: [oldDoc],
      getMeta: () => undefined,
      setMeta() {
        return this;
      },
    };

    const oldState = {
      doc: oldDoc,
      selection: { from: 5, to: 11, constructor: class {
        static create() {
          return { from: 5, to: 5 };
        }
      } },
      [pluginKey.name]: readPluginState(plugin),
    };

    expect(controller.willRevert(userTx, oldState)).toBe(true);

    const inverseStepsApplied: Array<unknown> = [];
    const tr: any = {
      doc: newDoc,
      mapping: identityMapping(),
      setMeta() {
        return tr;
      },
      maybeStep(step: unknown) {
        inverseStepsApplied.push(step);
        return { failed: null };
      },
      setSelection() {
        return tr;
      },
      scrollIntoView() {
        return tr;
      },
    };
    const newState = {
      doc: newDoc,
      tr,
      selection: oldState.selection,
      [pluginKey.name]: readPluginState(plugin),
    };
    const appendResult = plugin.spec.appendTransaction([userTx], oldState, newState);
    expect(appendResult).toBe(tr);
    expect(inverseStepsApplied).toEqual([inverseSentinel]);
  });
});

describe('canvas tracked changes plugin decorations', () => {
  it('renders insertions and deletions as inline decorations with the right classes', () => {
    const { plugin, env, pluginKey } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const next = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'hydrate',
              insertions: [{ changeId: 'i-1', from: 2, to: 5 }],
              deletions: [{ changeId: 'd-1', from: 5, to: 8, originalText: 'old' }],
            },
          ],
        },
      }),
      readPluginState(plugin)
    );

    const editorState = {
      [pluginKey.name]: next,
      doc: { content: { size: 50 } },
    };
    plugin.spec.props.decorations(editorState);

    expect(env.inline).toHaveBeenCalledWith(
      2,
      5,
      expect.objectContaining({ class: 'canvas-tracked-insertion' }),
      expect.any(Object)
    );
    expect(env.inline).toHaveBeenCalledWith(
      5,
      8,
      expect.objectContaining({ class: 'canvas-tracked-deletion' }),
      expect.any(Object)
    );
  });

  it('clamps decoration ranges to the document size', () => {
    const { plugin, env, pluginKey } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const hydrated = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'hydrate',
              insertions: [{ changeId: 'i-1', from: 0, to: 1000 }],
              deletions: [],
            },
          ],
        },
      }),
      readPluginState(plugin)
    );
    plugin.spec.props.decorations({
      [pluginKey.name]: hydrated,
      doc: { content: { size: 10 } },
    });
    expect(env.inline).toHaveBeenCalledWith(
      0,
      10,
      expect.objectContaining({ class: 'canvas-tracked-insertion' }),
      expect.any(Object)
    );
  });
});

describe('canvas tracked changes controller API', () => {
  function bindController() {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    const dispatchedTransactions: Array<{
      meta: Record<string, unknown>;
      insertTextCalls: Array<{ text: string; from: number; to: number }>;
    }> = [];

    let pluginState: any = readPluginState(plugin);

    const mockState = {
      get tr() {
        const meta: Record<string, unknown> = {};
        const insertTextCalls: Array<{ text: string; from: number; to: number }> = [];
        const tr = {
          setMeta(key: string, value: unknown) {
            meta[key] = value;
            return tr;
          },
          getMeta(key: string) {
            return meta[key];
          },
          insertText(text: string, from: number, to?: number) {
            insertTextCalls.push({ text, from, to: to ?? from });
            return tr;
          },
          mapping: identityMapping(),
          docChanged: true,
          steps: [],
          docs: [],
          __meta: meta,
          __insertTextCalls: insertTextCalls,
        };
        return tr;
      },
      [pluginKey.name]: pluginState,
      doc: { content: { size: 100 } },
    } as any;

    const view = {
      get state() {
        return mockState;
      },
      dispatch(tr: any) {
        dispatchedTransactions.push({
          meta: { ...tr.__meta },
          insertTextCalls: [...tr.__insertTextCalls],
        });
        // Aplicamos cualquier op meta al pluginState para que el siguiente tr lo refleje.
        pluginState = plugin.spec.state.apply(
          {
            mapping: identityMapping(),
            docChanged: true,
            steps: [],
            docs: [],
            getMeta: (key: string) => tr.__meta[key],
          } as any,
          pluginState
        );
        mockState[pluginKey.name] = pluginState;
      },
      updateState(s: any) {
        // No-op para los tests; los meta ops importan, no la vista en si.
      },
    };

    plugin.spec.view(view);
    return { controller, dispatchedTransactions, view, pluginKey, plugin, getPluginState: () => pluginState };
  }

  it('hydrate dispatches insertText for each text-insertion and a hydrate meta op', () => {
    const { controller, dispatchedTransactions, getPluginState } = bindController();
    controller.hydrate({
      insertions: [{ changeId: 'i-1', from: 5, to: 9 }],
      deletions: [
        { changeId: 'd-1', from: 9, to: 12, originalText: 'old' },
      ],
      textInsertions: [
        { position: 5, text: 'foo' },
        { position: 9, text: 'old' },
      ],
    });

    expect(dispatchedTransactions).toHaveLength(1);
    const [hydrationTx] = dispatchedTransactions;
    // Las inserciones de texto van en orden descendente para no invalidar offsets.
    expect(hydrationTx.insertTextCalls.map((call) => call.text)).toEqual(['old', 'foo']);
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    expect(hydrationTx.meta[opsKey]).toEqual([
      {
        type: 'hydrate',
        insertions: [{ changeId: 'i-1', from: 5, to: 9 }],
        deletions: [
          { changeId: 'd-1', from: 9, to: 12, originalText: 'old' },
        ],
      },
    ]);
    const state = getPluginState();
    expect(state.insertions.size).toBe(1);
    expect(state.deletions.size).toBe(1);
  });

  it('restoreDeletion dispatches a restore-deletion meta op and removes the range', () => {
    const { controller, dispatchedTransactions, getPluginState } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    expect(getPluginState().deletions.size).toBe(1);

    const ok = controller.restoreDeletion('d-1');
    expect(ok).toBe(true);
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const lastTx = dispatchedTransactions[dispatchedTransactions.length - 1];
    expect(lastTx.meta[opsKey]).toEqual([{ type: 'restore-deletion', changeId: 'd-1' }]);
    expect(getPluginState().deletions.size).toBe(0);
  });

  it('clear dispatches a clear meta op and empties the controller cache', () => {
    const { controller, dispatchedTransactions, getPluginState } = bindController();
    controller.hydrate({
      insertions: [{ changeId: 'i-1', from: 0, to: 3 }],
      deletions: [{ changeId: 'd-1', from: 3, to: 6, originalText: 'old' }],
      textInsertions: [{ position: 3, text: 'old' }],
    });
    expect(getPluginState().insertions.size).toBe(1);

    controller.clear();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const lastTx = dispatchedTransactions[dispatchedTransactions.length - 1];
    expect(lastTx.meta[opsKey]).toEqual([{ type: 'clear' }]);
  });

});

describe('canvas tracked changes plugin state · restore-snapshot meta op', () => {
  it('replaces the entire ranges state with the snapshot maps', () => {
    const { plugin } = buildPluginUnderTest();
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    const hydrated = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'hydrate',
              insertions: [{ changeId: 'i-1', from: 1, to: 4 }],
              deletions: [{ changeId: 'd-1', from: 5, to: 8, originalText: 'old' }],
            },
          ],
        },
      }),
      readPluginState(plugin)
    );
    expect(hydrated.insertions.size).toBe(1);
    expect(hydrated.deletions.size).toBe(1);

    const emptyInsertions = new Map();
    const emptyDeletions = new Map();
    const restored = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'restore-snapshot',
              snapshot: { insertions: emptyInsertions, deletions: emptyDeletions },
            },
          ],
        },
      }),
      hydrated
    );
    expect(restored.insertions.size).toBe(0);
    expect(restored.deletions.size).toBe(0);

    const repoplDeletions = new Map();
    repoplDeletions.set('d-2', { changeId: 'd-2', from: 9, to: 12, originalText: 'foo' });
    const repopulated = plugin.spec.state.apply(
      makeTransaction({
        meta: {
          [opsKey]: [
            {
              type: 'restore-snapshot',
              snapshot: { insertions: new Map(), deletions: repoplDeletions },
            },
          ],
        },
      }),
      restored
    );
    expect(repopulated.deletions.size).toBe(1);
    expect(repopulated.deletions.get('d-2')).toMatchObject({ from: 9, to: 12 });
  });
});

describe('canvas tracked changes snapshot stack (Ctrl+Z over marks)', () => {
  // Reuses the same harness as the controller-API suite. The harness applies
  // each dispatched transaction's meta ops to the plugin state, so we can
  // observe the user-visible effect of `controller.undo()` / `redo()`.
  function bindController() {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();
    const dispatchedTransactions: Array<{ meta: Record<string, unknown> }> = [];
    const updateStateCalls: Array<any> = [];
    const reconfigureCalls: Array<any> = [];
    let pluginState: any = readPluginState(plugin);
    const historyPlugin = { key: 'history$' };
    const otherPlugin = { key: 'other$' };
    const mockState = {
      get tr() {
        const meta: Record<string, unknown> = {};
        const tr = {
          setMeta(key: string, value: unknown) {
            meta[key] = value;
            return tr;
          },
          getMeta(key: string) {
            return meta[key];
          },
          insertText() {
            return tr;
          },
          mapping: identityMapping(),
          docChanged: true,
          steps: [],
          docs: [],
          __meta: meta,
        };
        return tr;
      },
      [pluginKey.name]: pluginState,
      doc: { content: { size: 100 } },
      plugins: [historyPlugin, otherPlugin],
      reconfigure(config: { plugins?: unknown[] }) {
        const nextState = {
          ...mockState,
          plugins: Array.isArray(config?.plugins) ? config.plugins : mockState.plugins,
          reconfigure: mockState.reconfigure,
        };
        reconfigureCalls.push(nextState);
        return nextState;
      },
    } as any;
    const view = {
      get state() {
        return mockState;
      },
      dispatch(tr: any) {
        dispatchedTransactions.push({ meta: { ...tr.__meta } });
        pluginState = plugin.spec.state.apply(
          {
            mapping: identityMapping(),
            docChanged: true,
            steps: [],
            docs: [],
            getMeta: (key: string) => tr.__meta[key],
          } as any,
          pluginState
        );
        mockState[pluginKey.name] = pluginState;
      },
      updateState(nextState: any) {
        updateStateCalls.push(nextState);
      },
    };
    plugin.spec.view(view);
    return {
      controller,
      dispatchedTransactions,
      getPluginState: () => pluginState,
      updateStateCalls,
      reconfigureCalls,
      historyPlugin,
      otherPlugin,
    };
  }

  it('starts with empty undo/redo stacks', () => {
    const { controller } = bindController();
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(false);
    expect(controller.undo()).toBe('noop');
    expect(controller.redo()).toBe('noop');
  });

  it('hydrate does not populate the undo stack (initial state is not undoable)', () => {
    const { controller } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    expect(controller.canUndo()).toBe(false);
  });

  it('restoreDeletion takes a pre-snapshot; undo restores the deletion mark, redo removes it again', () => {
    const { controller, getPluginState } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    expect(getPluginState().deletions.size).toBe(1);

    controller.restoreDeletion('d-1');
    expect(getPluginState().deletions.size).toBe(0);
    expect(controller.canUndo()).toBe(true);
    expect(controller.canRedo()).toBe(false);

    expect(controller.undo()).toBe('plugin');
    expect(getPluginState().deletions.size).toBe(1);
    expect(getPluginState().deletions.get('d-1')).toMatchObject({ from: 1, to: 4, originalText: 'foo' });
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(true);

    expect(controller.redo()).toBe('plugin');
    expect(getPluginState().deletions.size).toBe(0);
    expect(controller.canUndo()).toBe(true);
    expect(controller.canRedo()).toBe(false);
  });

  it('a new restoreDeletion after an undo invalidates the redo stack', () => {
    const { controller, getPluginState } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [
        { changeId: 'd-1', from: 1, to: 4, originalText: 'foo' },
        { changeId: 'd-2', from: 6, to: 9, originalText: 'bar' },
      ],
      textInsertions: [{ position: 6, text: 'bar' }, { position: 1, text: 'foo' }],
    });
    expect(getPluginState().deletions.size).toBe(2);

    controller.restoreDeletion('d-1');
    expect(controller.canUndo()).toBe(true);
    controller.undo();
    expect(controller.canRedo()).toBe(true);

    controller.restoreDeletion('d-2');
    expect(controller.canRedo()).toBe(false);
  });

  it('with only doc-history pushes, undo/redo delegates to PM history (returns "doc")', () => {
    const { controller } = bindController();
    controller.recordDocHistoryPush();
    expect(controller.canUndo()).toBe(true);
    expect(controller.undo()).toBe('doc');
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(true);
    expect(controller.redo()).toBe('doc');
    expect(controller.canRedo()).toBe(false);
  });

  it('interleaved doc + plugin pushes: undo pops most-recent first; redo re-applies in chronological order', () => {
    const { controller, getPluginState } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    // Timeline:
    //   seq=1  doc-history (typed something)
    //   seq=2  plugin (restoreDeletion 'd-1')
    controller.recordDocHistoryPush();
    controller.restoreDeletion('d-1');
    expect(getPluginState().deletions.size).toBe(0);

    // Undo pops the most recent → plugin first.
    expect(controller.undo()).toBe('plugin');
    expect(getPluginState().deletions.size).toBe(1);

    // Then PM history.
    expect(controller.undo()).toBe('doc');
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(true);

    // Redo re-applies in original order: doc (seq=1) first, then plugin (seq=2).
    expect(controller.redo()).toBe('doc');
    expect(controller.redo()).toBe('plugin');
    expect(getPluginState().deletions.size).toBe(0);
    expect(controller.canRedo()).toBe(false);
  });

  it('a new doc-history push after undo invalidates BOTH redo stacks (plugin + docRedo)', () => {
    const { controller } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    controller.restoreDeletion('d-1');
    controller.undo();
    expect(controller.canRedo()).toBe(true);

    controller.recordDocHistoryPush();
    expect(controller.canRedo()).toBe(false);
  });

  it('clear() resets the snapshot stacks', () => {
    const { controller } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    controller.restoreDeletion('d-1');
    expect(controller.canUndo()).toBe(true);

    controller.clear();
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(false);
  });

  it('resetUndoRedoHistory clears plugin/doc timelines and resets the PM history plugin', () => {
    const { controller, updateStateCalls, reconfigureCalls, getPluginState, historyPlugin, otherPlugin } =
      bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    controller.recordDocHistoryPush();
    controller.restoreDeletion('d-1');
    expect(controller.canUndo()).toBe(true);
    expect(getPluginState().deletions.size).toBe(0);

    controller.resetUndoRedoHistory();

    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(false);
    expect(getPluginState().deletions.size).toBe(0);
    expect(updateStateCalls).toHaveLength(1);
    expect(reconfigureCalls).toHaveLength(2);
    expect(reconfigureCalls[0].plugins).toEqual([otherPlugin]);
    expect(reconfigureCalls[1].plugins).toEqual([historyPlugin, otherPlugin]);
  });

  it('hydrate after some history resets the timeline (older snapshots no longer reachable)', () => {
    const { controller } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    controller.restoreDeletion('d-1');
    expect(controller.canUndo()).toBe(true);

    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-2', from: 0, to: 3, originalText: 'bar' }],
      textInsertions: [{ position: 0, text: 'bar' }],
    });
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(false);
  });

  it('undo dispatches a restore-snapshot meta op marked as internal and not in PM history', () => {
    const { controller, dispatchedTransactions } = bindController();
    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 1, to: 4, originalText: 'foo' }],
      textInsertions: [{ position: 1, text: 'foo' }],
    });
    controller.restoreDeletion('d-1');
    const beforeUndo = dispatchedTransactions.length;
    controller.undo();
    const undoTx = dispatchedTransactions[beforeUndo];
    const opsKey = 'canvas-tracked-changes-decorations-ops';
    expect(Array.isArray(undoTx.meta[opsKey])).toBe(true);
    const ops = undoTx.meta[opsKey] as Array<Record<string, unknown>>;
    expect(ops[0].type).toBe('restore-snapshot');
    expect(undoTx.meta['addToHistory']).toBe(false);
    expect(undoTx.meta['canvas-tracked-changes-internal']).toBe(true);
  });

  it('grouping window: rapid doc-history pushes coalesce into a single seq', () => {
    const { controller } = bindController();
    controller.recordDocHistoryPush();
    controller.recordDocHistoryPush();
    controller.recordDocHistoryPush();
    // Three rapid pushes within the 500ms window should still result in
    // exactly one undoable doc event.
    expect(controller.undo()).toBe('doc');
    expect(controller.canUndo()).toBe(false);
  });
});

describe('canvas tracked changes clean content extraction', () => {
  it('returns plain markdown when no deletions are tracked', () => {
    const { controller, plugin } = buildPluginUnderTest();
    const view = {
      state: { doc: {}, tr: {}, apply: () => view.state },
      updateState: vi.fn(),
    };
    plugin.spec.view(view);

    const editorInstance = {
      wwEditor: { view },
      getMarkdown: () => 'plain markdown',
    };
    expect(controller.getCleanMarkdown(editorInstance)).toBe('plain markdown');
  });

  it('removes deletion ranges before serializing markdown and restores the original state', () => {
    const { controller, plugin, pluginKey } = buildPluginUnderTest();

    let pluginState: any = readPluginState(plugin);

    const cleanState: any = { doc: { content: { size: 30 } } };
    const dirtyState: any = {
      get [pluginKey.name]() {
        return pluginState;
      },
      doc: { content: { size: 50 } },
      get tr() {
        const meta: Record<string, unknown> = {};
        const insertTextCalls: Array<{ text: string; from: number; to: number }> = [];
        const deletedRanges: Array<{ from: number; to: number }> = [];
        const tr = {
          mapping: identityMapping(),
          docChanged: true,
          steps: [],
          docs: [],
          setMeta(key: string, value: unknown) {
            meta[key] = value;
            return tr;
          },
          getMeta(key: string) {
            return meta[key];
          },
          insertText(text: string, from: number, to?: number) {
            insertTextCalls.push({ text, from, to: to ?? from });
            return tr;
          },
          delete(from: number, to: number) {
            deletedRanges.push({ from, to });
            return tr;
          },
          __meta: meta,
          __insertTextCalls: insertTextCalls,
          __deletedRanges: deletedRanges,
        };
        return tr;
      },
      apply(tr: any) {
        // Cuando el caller pide aplicar un tr (limpieza), devolvemos cleanState.
        capturedDeletedRanges = [...(tr.__deletedRanges || [])];
        return cleanState;
      },
    };

    let capturedDeletedRanges: Array<{ from: number; to: number }> = [];
    let currentMarkdown = 'Hola viejo mundo';
    const view = {
      get state() {
        return dirtyState;
      },
      dispatch(tr: any) {
        const synthetic = {
          mapping: identityMapping(),
          docChanged: true,
          steps: [],
          docs: [],
          getMeta: (key: string) => tr.__meta?.[key],
        };
        pluginState = plugin.spec.state.apply(synthetic, pluginState);
      },
      updateState: vi.fn((s: any) => {
        currentMarkdown = s === cleanState ? 'Hola mundo' : 'Hola viejo mundo';
      }),
    };
    plugin.spec.view(view);

    controller.hydrate({
      insertions: [],
      deletions: [{ changeId: 'd-1', from: 5, to: 11, originalText: 'viejo ' }],
      textInsertions: [],
    });

    expect(pluginState.deletions.size).toBe(1);

    const editorInstance = {
      wwEditor: { view },
      getMarkdown: () => currentMarkdown,
    };
    const markdown = controller.getCleanMarkdown(editorInstance);
    expect(markdown).toBe('Hola mundo');
    expect(view.updateState).toHaveBeenCalledTimes(2);
    expect(capturedDeletedRanges).toEqual([{ from: 5, to: 11 }]);
  });
});
