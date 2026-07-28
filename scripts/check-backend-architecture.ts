import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const TEST_ONLY_PACKAGES = new Set(['node:assert', 'node:test', 'vitest']);

const DEFAULT_RUNTIME_IDENTIFIERS = [
  'AbortSignal',
  'DurableObject',
  'Fetcher',
  'Headers',
  'ReadableStream',
  'Request',
  'RequestInfo',
  'RequestInit',
  'Response',
  'URL',
  'URLSearchParams',
];

export interface TBackendArchitectureOptions {
  root: string;
  featureRoot?: string;
  requireAbsoluteImports?: boolean;
  allowedApplicationRoots?: readonly string[];
  forbiddenFeatureOuterRoots?: readonly string[];
  forbiddenRootRuntimeModules?: readonly string[];
  featureRootForbiddenPackages?: readonly string[];
  featureRootPureFileSuffixes?: readonly string[];
  requireFeaturePublicApi?: boolean;
  runtimeIdentifiers?: readonly string[];
  sharedRoot?: string;
  sharedForbiddenLocalRoots?: readonly string[];
  sharedForbiddenPackages?: readonly string[];
}

type TFeature = {
  name: string;
  path: string;
  relativePath: string;
};

type TInspectionBase = {
  filePath: string;
  specifier: string;
  violations: string[];
};

type TInnerLayerInspection = TInspectionBase & {
  allowedApplicationRoots: readonly string[];
  feature: TFeature;
  localImport: string | null;
  testFile: boolean;
};

type TRuntimeIdentifierInspection = {
  filePath: string;
  runtimeIdentifiers: readonly string[];
  source: string;
  violations: string[];
};

type TSharedBoundaryInspection = TInspectionBase & {
  localImport: string | null;
  sharedForbiddenLocalRoots: readonly string[];
  sharedForbiddenPackages: readonly string[];
};

const normalize = (path: string): string => path.split(sep).join('/');
const withoutExtension = (path: string): string =>
  path.replace(/\.(?:[cm]?js|tsx?)$/, '');
const isInside = (path: string, directory: string): boolean =>
  path === directory || path.startsWith(`${directory}/`);
const isTestFile = (path: string): boolean => /(?:^|\.)test\.tsx?$/.test(path);
const isAllowedTestPackage = (specifier: string): boolean =>
  TEST_ONLY_PACKAGES.has(specifier) || specifier.startsWith('@vitest/');
const matchesPackage = (
  specifier: string,
  packages: readonly string[],
): boolean =>
  packages.some(
    (dependency) =>
      specifier === dependency || specifier.startsWith(`${dependency}/`),
  );

const collectTypeScriptFiles = async (
  root: string,
  directory = root,
): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(root, path);
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
};

const resolveLocalImport = (
  root: string,
  file: string,
  specifier: string,
): string | null => {
  if (specifier.startsWith('@/')) return withoutExtension(specifier.slice(2));
  if (!specifier.startsWith('.')) return null;
  return withoutExtension(
    normalize(relative(root, resolve(dirname(file), specifier))),
  );
};

const readFeature = (path: string, featureRoot: string): TFeature | null => {
  const prefix = `${featureRoot}/`;
  if (!path.startsWith(prefix)) return null;
  const [name, ...rest] = path.slice(prefix.length).split('/');
  if (!name) return null;
  return {
    name,
    path: `${featureRoot}/${name}`,
    relativePath: rest.join('/'),
  };
};

const matchesRootModule = (
  path: string,
  rootModules: readonly string[],
): boolean =>
  rootModules.some((module) => isInside(path, withoutExtension(module)));

const inspectInnerLayer = ({
  allowedApplicationRoots,
  filePath,
  feature,
  localImport,
  specifier,
  testFile,
  violations,
}: TInnerLayerInspection): void => {
  const layer = feature.relativePath.split('/')[0];
  if (layer !== 'domain' && layer !== 'application') return;

  if (localImport) {
    const allowedLocalRoots =
      layer === 'domain'
        ? [`${feature.path}/domain`]
        : [
            `${feature.path}/application`,
            `${feature.path}/domain`,
            ...allowedApplicationRoots,
          ];
    if (!allowedLocalRoots.some((root) => isInside(localImport, root))) {
      const description =
        layer === 'domain'
          ? 'imports outside the feature domain'
          : 'imports forbidden outer dependency';
      violations.push(`${filePath} ${description} "${specifier}"`);
    }
  } else if (!(testFile && isAllowedTestPackage(specifier))) {
    violations.push(
      `${filePath} imports forbidden runtime dependency "${specifier}"`,
    );
  }
};

const inspectRuntimeIdentifiers = ({
  filePath,
  runtimeIdentifiers,
  source,
  violations,
}: TRuntimeIdentifierInspection): void => {
  const forbiddenRuntimeIdentifier = runtimeIdentifiers.find((identifier) =>
    new RegExp(`\\b${identifier}\\b`).test(source),
  );
  if (forbiddenRuntimeIdentifier) {
    violations.push(
      `${filePath} references forbidden runtime identifier "${forbiddenRuntimeIdentifier}"`,
    );
  }
};

const isFeatureRootPureFile = (
  feature: TFeature,
  suffixes: readonly string[],
): boolean => {
  const modulePath = withoutExtension(feature.relativePath);
  return (
    !modulePath.includes('/') &&
    suffixes.some((suffix) => modulePath.endsWith(suffix))
  );
};

const inspectSharedBoundary = ({
  filePath,
  localImport,
  sharedForbiddenLocalRoots,
  sharedForbiddenPackages,
  specifier,
  violations,
}: TSharedBoundaryInspection): void => {
  const forbidden = localImport
    ? sharedForbiddenLocalRoots.some((root) => isInside(localImport, root))
    : sharedForbiddenPackages.some(
        (dependency) =>
          specifier === dependency || specifier.startsWith(`${dependency}/`),
      );
  if (forbidden) {
    violations.push(
      `${filePath} imports forbidden outer dependency "${specifier}"`,
    );
  }
};

export const checkBackendArchitecture = async ({
  root,
  featureRoot = 'features',
  requireAbsoluteImports = false,
  allowedApplicationRoots = ['shared'],
  forbiddenFeatureOuterRoots = ['adapters', 'config', 'infra', 'platform'],
  forbiddenRootRuntimeModules = ['adapters', 'config', 'index', 'platform'],
  featureRootForbiddenPackages = [],
  featureRootPureFileSuffixes = [],
  requireFeaturePublicApi = true,
  runtimeIdentifiers = DEFAULT_RUNTIME_IDENTIFIERS,
  sharedRoot = 'shared',
  sharedForbiddenLocalRoots = ['adapters', 'features'],
  sharedForbiddenPackages = [],
}: TBackendArchitectureOptions): Promise<string[]> => {
  const absoluteRoot = resolve(root);
  const violations: string[] = [];
  const files = await collectTypeScriptFiles(absoluteRoot);
  const filePaths = files.map((file) =>
    normalize(relative(absoluteRoot, file)),
  );
  const fileModules = new Set(filePaths.map(withoutExtension));
  const features = new Map<string, TFeature>();

  for (const filePath of filePaths) {
    const feature = readFeature(filePath, featureRoot);
    if (feature) features.set(feature.name, feature);
  }

  if (requireFeaturePublicApi) {
    for (const feature of features.values()) {
      if (!fileModules.has(`${feature.path}/index`)) {
        violations.push(`${feature.path} is missing its Public API index.ts`);
      }
    }
  }

  for (const file of files) {
    const filePath = normalize(relative(absoluteRoot, file));
    const source = await readFile(file, 'utf8');
    const sourceFeature = readFeature(filePath, featureRoot);
    const testFile = isTestFile(filePath);
    const featureRootPureFile =
      sourceFeature !== null &&
      isFeatureRootPureFile(sourceFeature, featureRootPureFileSuffixes);

    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier) continue;

      if (requireAbsoluteImports && specifier.startsWith('.')) {
        violations.push(
          `${filePath} uses forbidden relative import "${specifier}"; use an absolute source alias instead`,
        );
        continue;
      }

      const localImport = resolveLocalImport(absoluteRoot, file, specifier);
      const targetFeature = localImport
        ? readFeature(localImport, featureRoot)
        : null;

      if (
        sourceFeature &&
        targetFeature &&
        sourceFeature.name !== targetFeature.name
      ) {
        violations.push(
          `${filePath} imports another feature "${targetFeature.path}" via "${specifier}"`,
        );
        continue;
      }

      if (sourceFeature) {
        inspectInnerLayer({
          allowedApplicationRoots,
          filePath,
          feature: sourceFeature,
          localImport,
          specifier,
          testFile,
          violations,
        });

        if (
          featureRootPureFile &&
          !localImport &&
          !(testFile && isAllowedTestPackage(specifier)) &&
          matchesPackage(specifier, featureRootForbiddenPackages)
        ) {
          violations.push(
            `${filePath} imports forbidden runtime dependency "${specifier}"`,
          );
        }

        const layer = sourceFeature.relativePath.split('/')[0];
        if (
          (layer === 'adapters' || layer === 'infra') &&
          localImport &&
          matchesRootModule(localImport, forbiddenRootRuntimeModules)
        ) {
          violations.push(
            `${filePath} imports forbidden root runtime module "${specifier}"`,
          );
        }

        if (
          layer !== 'domain' &&
          layer !== 'application' &&
          layer !== 'adapters' &&
          layer !== 'infra' &&
          localImport &&
          forbiddenFeatureOuterRoots.some((root) => isInside(localImport, root))
        ) {
          violations.push(
            `${filePath} imports forbidden outer dependency "${specifier}"`,
          );
        }
      } else if (
        !testFile &&
        targetFeature &&
        localImport !== targetFeature.path &&
        localImport !== `${targetFeature.path}/index`
      ) {
        violations.push(
          `${filePath} deep-imports the ${targetFeature.name} feature: "${specifier}"; import "${targetFeature.path}/index" instead`,
        );
      }

      if (isInside(filePath, sharedRoot)) {
        inspectSharedBoundary({
          filePath,
          localImport,
          sharedForbiddenLocalRoots,
          sharedForbiddenPackages,
          specifier,
          violations,
        });
      }
    }

    if (sourceFeature) {
      const layer = sourceFeature.relativePath.split('/')[0];
      if (
        layer === 'domain' ||
        layer === 'application' ||
        featureRootPureFile
      ) {
        inspectRuntimeIdentifiers({
          filePath,
          runtimeIdentifiers,
          source,
          violations,
        });
      }
    }
  }

  return violations;
};

export const printArchitectureResult = ({
  label,
  violations,
}: {
  label: string;
  violations: readonly string[];
}): void => {
  if (violations.length > 0) {
    process.stderr.write(
      `${label} architecture violations:\n${violations.join('\n')}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${label} feature-first dependency rule: PASS\n`);
};
