/**
 * Directory Vite emits bundled chunks and assets into (`build.assetsDir`).
 */
const ASSETS_SEGMENT = '/assets/';

/**
 * Re-anchor a bundled asset URL on the location this bundle was served from.
 *
 * Vite resolves asset URLs against `base` ("/"), so an asset imported with
 * `?url` becomes an origin-absolute string baked into the chunk. A host that
 * serves the app under a path prefix (an embedded session URL, for example)
 * rewrites the HTML but cannot rewrite a string inside the JS, and the asset is
 * then requested from the domain root instead of from the deployment. The URL a
 * chunk was loaded from does carry that prefix, so everything before its own
 * assets segment is the real base.
 *
 * Only assets whose URL is fetched as a string need this. Dynamic imports and
 * chunk URLs are already resolved by the module loader relative to the importer.
 *
 * @param assetUrl Asset URL as Vite baked it into the bundle.
 * @param moduleUrl `import.meta.url` of the calling module.
 * @returns The prefixed URL, or `assetUrl` unchanged when either side does not
 *   follow that layout: the dev server serves modules from source paths, and a
 *   CDN `base` already yields an absolute URL.
 */
export const resolveBundledAssetUrl = (
  assetUrl: string,
  moduleUrl: string
): string => {
  const baseEnd = moduleUrl.lastIndexOf(ASSETS_SEGMENT);
  if (baseEnd < 0 || !assetUrl.startsWith(ASSETS_SEGMENT)) {
    return assetUrl;
  }
  return moduleUrl.slice(0, baseEnd) + assetUrl;
};
