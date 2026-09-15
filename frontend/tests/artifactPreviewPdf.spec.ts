import { describe, expect, it, vi } from 'vitest';

import {
  BINARY_MIME,
  createBinaryBlob,
  fetchPdfBlob,
  officeArtifactPath,
  requirePdfMagic
} from '../../../../backend/public/elements/artifact-preview/dataUrl.js';

const MIN_PDF = '%PDF-1.4\n%%EOF\n';

function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('artifact preview PDF magic', () => {
  it('accepts a payload that starts with %PDF-', () => {
    const bytes = toBytes(MIN_PDF);
    expect(requirePdfMagic(bytes)).toBe(bytes);
  });

  it('rejects HTML that pdf.js would parse as a broken hex string', () => {
    expect(() => requirePdfMagic(toBytes('<!DOCTYPE html><html>'))).toThrow(
      /expected a PDF/
    );
  });

  it('loads an office preview through the host POST client', async () => {
    const apiClient = {
      post: vi.fn(async () => ({
        arrayBuffer: async () => toBytes(MIN_PDF).buffer
      }))
    };
    const blob = await fetchPdfBlob(apiClient, 'file-1', 'session-1');
    expect(apiClient.post).toHaveBeenCalledWith(
      officeArtifactPath('preview', 'file-1', 'session-1'),
      {},
      undefined
    );
    expect(blob.type).toBe(BINARY_MIME.pdf);
  });

  it('refuses a pdf data URL whose bytes are not a PDF', () => {
    const html = btoa('<!DOCTYPE html><html>');
    expect(() =>
      createBinaryBlob(`data:${BINARY_MIME.pdf};base64,${html}`, BINARY_MIME.pdf)
    ).toThrow(/expected a PDF/);
  });
});
