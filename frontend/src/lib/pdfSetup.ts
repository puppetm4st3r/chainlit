import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { pdfjs } from 'react-pdf';

import { resolveBundledAssetUrl } from '@/lib/bundledAssetUrl';

/**
 * Point pdf.js at the bundled worker, resolved against the location this chunk
 * was served from so it survives a host that mounts the app under a prefix.
 *
 * Without a reachable worker, pdf.js falls back to a fake worker that
 * dynamically imports the same URL, so a wrong path surfaces as a document load
 * failure rather than as a slow render.
 */
pdfjs.GlobalWorkerOptions.workerSrc = resolveBundledAssetUrl(
  workerUrl,
  import.meta.url
);
