import { importCode } from 'react-runner';

const IMPORT_STATEMENT_RE =
  /^\s*import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["'];?\s*$/gm;

/**
 * Check whether an import specifier points to a sibling custom-element module.
 */
export function isRelativeImportSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * Collect every relative import used by a custom element source file.
 */
export function extractRelativeImportSpecifiers(sourceCode: string): string[] {
  const specifiers = new Set<string>();

  for (const match of sourceCode.matchAll(IMPORT_STATEMENT_RE)) {
    const specifier = match[1];
    if (isRelativeImportSpecifier(specifier)) {
      specifiers.add(specifier);
    }
  }

  return Array.from(specifiers);
}

/**
 * Resolve a relative import specifier against the importing module path.
 */
export function resolveRelativeModulePath(
  importerPath: string,
  specifier: string
): string {
  if (!isRelativeImportSpecifier(specifier)) {
    return specifier;
  }

  const resolvedSegments = importerPath.split('/');
  resolvedSegments.pop();

  for (const segment of specifier.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (resolvedSegments.length === 0) {
        throw new Error(
          `Cannot resolve custom element import '${specifier}' from '${importerPath}'.`
        );
      }
      resolvedSegments.pop();
      continue;
    }

    resolvedSegments.push(segment);
  }

  return resolvedSegments.join('/');
}

/**
 * Encode a custom element module path for the `/public/elements/*` endpoint.
 */
export function encodePublicElementModulePath(modulePath: string): string {
  return modulePath.split('/').map(encodeURIComponent).join('/');
}

/**
 * Load the root custom element source and recursively compile sibling modules.
 */
export async function loadCustomElementModuleTree({
  rootModulePath,
  fetchModuleSource,
  baseImports,
}: {
  rootModulePath: string;
  fetchModuleSource: (publicPath: string) => Promise<string>;
  baseImports: Record<string, unknown>;
}): Promise<{
  sourceCode: string;
  localImports: Record<string, unknown>;
}> {
  const sourceCache = new Map<string, Promise<string>>();
  const moduleCache = new Map<string, Promise<Record<string, unknown>>>();

  /**
   * Read a module source once, even when shared by multiple importers.
   */
  const readSource = (modulePath: string): Promise<string> => {
    if (!sourceCache.has(modulePath)) {
      sourceCache.set(
        modulePath,
        fetchModuleSource(
          `/public/elements/${encodePublicElementModulePath(modulePath)}`
        ).then((sourceCode) => {
          const normalizedSource = String(sourceCode ?? '');
          if (!normalizedSource.trim()) {
            throw new Error(
              `Custom element module '${modulePath}' is empty.`
            );
          }
          return normalizedSource;
        })
      );
    }

    return sourceCache.get(modulePath)!;
  };

  /**
   * Compile one sibling module into the object shape expected by `react-runner`.
   */
  const compileModule = async (
    modulePath: string
  ): Promise<Record<string, unknown>> => {
    if (!moduleCache.has(modulePath)) {
      moduleCache.set(
        modulePath,
        (async () => {
          const sourceCode = await readSource(modulePath);
          const nestedLocalImports = await Promise.all(
            extractRelativeImportSpecifiers(sourceCode).map(async (specifier) => [
              specifier,
              await compileModule(
                resolveRelativeModulePath(modulePath, specifier)
              ),
            ])
          );

          return importCode(sourceCode, {
            import: {
              ...baseImports,
              ...Object.fromEntries(nestedLocalImports),
            },
          });
        })()
      );
    }

    return moduleCache.get(modulePath)!;
  };

  const sourceCode = await readSource(rootModulePath);
  const localImports = Object.fromEntries(
    await Promise.all(
      extractRelativeImportSpecifiers(sourceCode).map(async (specifier) => [
        specifier,
        await compileModule(resolveRelativeModulePath(rootModulePath, specifier)),
      ])
    )
  );

  return {
    sourceCode,
    localImports,
  };
}
