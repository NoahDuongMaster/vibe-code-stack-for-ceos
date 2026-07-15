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

const normalize = (path) => path.split(sep).join('/');
const withoutExtension = (path) => path.replace(/\.(?:[cm]?js|tsx?)$/, '');
const isInside = (path, directory) =>
  path === directory || path.startsWith(`${directory}/`);
const isTestFile = (path) => /(?:^|\.)test\.tsx?$/.test(path);
const isAllowedTestPackage = (specifier) =>
  TEST_ONLY_PACKAGES.has(specifier) || specifier.startsWith('@vitest/');

const collectTypeScriptFiles = async (root, directory = root) => {
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

const resolveLocalImport = (root, file, specifier) => {
  if (specifier.startsWith('@/')) return withoutExtension(specifier.slice(2));
  if (!specifier.startsWith('.')) return null;
  return withoutExtension(
    normalize(relative(root, resolve(dirname(file), specifier))),
  );
};

const readFeature = (path, featureRoot) => {
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

const matchesRootModule = (path, rootModules) =>
  rootModules.some((module) => isInside(path, withoutExtension(module)));

const inspectInnerLayer = ({
  allowedApplicationRoots,
  filePath,
  feature,
  localImport,
  runtimeIdentifiers,
  source,
  specifier,
  testFile,
  violations,
}) => {
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

  const forbiddenRuntimeIdentifier = runtimeIdentifiers.find((identifier) =>
    new RegExp(`\\b${identifier}\\b`).test(source),
  );
  if (forbiddenRuntimeIdentifier) {
    violations.push(
      `${filePath} references forbidden runtime identifier "${forbiddenRuntimeIdentifier}"`,
    );
  }
};

const inspectSharedBoundary = ({
  filePath,
  localImport,
  sharedForbiddenLocalRoots,
  sharedForbiddenPackages,
  specifier,
  violations,
}) => {
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
  runtimeIdentifiers = DEFAULT_RUNTIME_IDENTIFIERS,
  sharedRoot = 'shared',
  sharedForbiddenLocalRoots = ['adapters', 'features'],
  sharedForbiddenPackages = [],
}) => {
  const absoluteRoot = resolve(root);
  const violations = [];
  const files = await collectTypeScriptFiles(absoluteRoot);

  for (const file of files) {
    const filePath = normalize(relative(absoluteRoot, file));
    const source = await readFile(file, 'utf8');
    const sourceFeature = readFeature(filePath, featureRoot);
    const testFile = isTestFile(filePath);

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
          runtimeIdentifiers,
          source,
          specifier,
          testFile,
          violations,
        });

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
  }

  return violations;
};

export const printArchitectureResult = ({ label, violations }) => {
  if (violations.length > 0) {
    process.stderr.write(
      `${label} architecture violations:\n${violations.join('\n')}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${label} feature-first dependency rule: PASS\n`);
};
