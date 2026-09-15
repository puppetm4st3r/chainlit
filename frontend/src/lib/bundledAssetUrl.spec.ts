import { describe, expect, it } from 'vitest';

import { resolveBundledAssetUrl } from './bundledAssetUrl';

const SESSION_CHUNK =
  'https://host.example/prx/api/agents/fullscreen/session/tok3n/assets/index-abc123.js';

describe('resolveBundledAssetUrl', () => {
  it('serves the asset from the prefix the chunk itself was served from', () => {
    expect(
      resolveBundledAssetUrl('/assets/pdf.worker.min-hash.mjs', SESSION_CHUNK)
    ).toBe(
      'https://host.example/prx/api/agents/fullscreen/session/tok3n/assets/pdf.worker.min-hash.mjs'
    );
  });

  it('leaves the asset alone when the app is mounted at the domain root', () => {
    expect(
      resolveBundledAssetUrl(
        '/assets/pdf.worker.min-hash.mjs',
        'https://host.example/assets/index-abc123.js'
      )
    ).toBe('https://host.example/assets/pdf.worker.min-hash.mjs');
  });

  it('leaves the asset alone under the dev server, which serves source paths', () => {
    expect(
      resolveBundledAssetUrl(
        '/node_modules/.vite/deps/pdf.worker.min.mjs',
        'http://localhost:5173/src/lib/pdfSetup.ts'
      )
    ).toBe('/node_modules/.vite/deps/pdf.worker.min.mjs');
  });

  it('leaves an already absolute asset URL alone, as a CDN base yields', () => {
    expect(
      resolveBundledAssetUrl(
        'https://cdn.example/assets/pdf.worker.min-hash.mjs',
        SESSION_CHUNK
      )
    ).toBe('https://cdn.example/assets/pdf.worker.min-hash.mjs');
  });

  it('anchors on the assets segment of the chunk, not on an earlier one', () => {
    expect(
      resolveBundledAssetUrl(
        '/assets/pdf.worker.min-hash.mjs',
        'https://host.example/assets/tenant/assets/index-abc123.js'
      )
    ).toBe('https://host.example/assets/tenant/assets/pdf.worker.min-hash.mjs');
  });
});
