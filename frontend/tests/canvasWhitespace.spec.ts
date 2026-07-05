import { describe, expect, it } from 'vitest';

import {
  decodeVisibleSpaceRuns,
  encodeVisibleSpaceRuns,
  patchCollapsedSpaceRunsFromVisibleText
} from '../../../../backend/public/elements/canvas-editor/whitespace.js';

describe('canvas whitespace helpers', () => {
  it('encodes only internal runs of two or more regular spaces', () => {
    expect(encodeVisibleSpaceRuns('foo  bar')).toBe('foo\u00a0 bar');
    expect(encodeVisibleSpaceRuns('foo   bar')).toBe('foo\u00a0\u00a0 bar');
    expect(encodeVisibleSpaceRuns('  indented\ntrail  \nfoo bar')).toBe(
      '  indented\ntrail  \nfoo bar'
    );
    expect(encodeVisibleSpaceRuns('-  list item\n##  Heading')).toBe(
      '-  list item\n##  Heading'
    );
  });

  it('decodes preserved visual spaces for model-facing content', () => {
    expect(decodeVisibleSpaceRuns('foo\u00a0\u00a0 bar')).toBe('foo   bar');
  });

  it('patches collapsed plain-text runs using visible editor evidence', () => {
    expect(patchCollapsedSpaceRunsFromVisibleText('foo bar', 'foo   bar')).toBe(
      'foo\u00a0\u00a0 bar'
    );
  });

  it('patches collapsed runs inside styled markdown without rewriting the style syntax', () => {
    expect(patchCollapsedSpaceRunsFromVisibleText('**foo bar**', 'foo  bar')).toBe(
      '**foo\u00a0 bar**'
    );
    expect(patchCollapsedSpaceRunsFromVisibleText('`foo bar`', 'foo   bar')).toBe(
      '`foo\u00a0\u00a0 bar`'
    );
  });
});
