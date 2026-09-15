import { describe, expect, it } from 'vitest';

import { resolveFileChipKind, splitFileChipName } from './fileChip';

describe('splitFileChipName', () => {
  it('splits the last extension and keeps the visible title', () => {
    expect(splitFileChipName('Migracion chainlit a openwebui.pptx')).toEqual({
      title: 'Migracion chainlit a openwebui',
      extension: 'pptx'
    });
  });

  it('keeps the full name when there is no extension', () => {
    expect(splitFileChipName('notes')).toEqual({
      title: 'notes',
      extension: ''
    });
  });
});

describe('resolveFileChipKind', () => {
  it('maps office and mime types onto closed kinds', () => {
    expect(resolveFileChipKind('application/vnd.ms-powerpoint', 'pptx')).toBe(
      'presentation'
    );
    expect(resolveFileChipKind('application/pdf', '')).toBe('pdf');
    expect(resolveFileChipKind('image/png', 'png')).toBe('image');
    expect(resolveFileChipKind('text/plain', 'txt')).toBe('text');
    expect(resolveFileChipKind('application/octet-stream', 'bin')).toBe('file');
  });
});
