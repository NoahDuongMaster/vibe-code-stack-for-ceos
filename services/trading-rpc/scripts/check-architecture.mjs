import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../src', import.meta.url));
const FEATURE = 'features/get-crypto-markets';
const DOMAIN = `${FEATURE}/domain`;
const APPLICATION = `${FEATURE}/application`;
const TEST_ONLY_PACKAGES = new Set(['node:assert', 'node:test', 'vitest']);
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const normalize = (path) => path.split(sep).join('/');
const isInside = (path, directory) =>
  path === directory || path.startsWith(`${directory}/`);
const isTestFile = (path) => /(?:^|\.)test\.tsx?$/.test(path);
const withoutExtension = (path) => path.replace(/\.(?:[cm]?js|tsx?)$/, '');

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
  if (specifier.startsWith('@/')) return specifier.slice(2);
  if (specifier.startsWith('.')) {
    return normalize(relative(root, resolve(dirname(file), specifier)));
  }
  return null;
};

const isAllowedTestPackage = (specifier) =>
  TEST_ONLY_PACKAGES.has(specifier) || specifier.startsWith('@vitest/');

const isForbiddenRootRuntimeModule = (path) => {
  const normalized = withoutExtension(path);
  return (
    normalized === 'index' ||
    isInside(normalized, 'config') ||
    normalized === 'adapters/http.adapter' ||
    normalized === 'infra/rpc-transport'
  );
};

const inspectImport = ({ file, filePath, root, specifier, violations }) => {
  const localImport = resolveLocalImport(root, file, specifier);
  const testFile = isTestFile(filePath);

  if (isInside(filePath, DOMAIN)) {
    if (localImport && !isInside(localImport, DOMAIN)) {
      violations.push(
        `${filePath} imports outside the feature domain: "${specifier}"`,
      );
    } else if (!localImport && !(testFile && isAllowedTestPackage(specifier))) {
      violations.push(
        `${filePath} imports outside the feature domain: "${specifier}"`,
      );
    }
    return;
  }

  if (isInside(filePath, APPLICATION)) {
    if (localImport) {
      if (
        !isInside(localImport, APPLICATION) &&
        !isInside(localImport, DOMAIN)
      ) {
        violations.push(
          `${filePath} imports forbidden outer dependency "${specifier}"`,
        );
      }
    } else if (!(testFile && isAllowedTestPackage(specifier))) {
      violations.push(
        `${filePath} imports forbidden runtime dependency "${specifier}"`,
      );
    }
    return;
  }

  if (
    isInside(filePath, `${FEATURE}/adapters`) ||
    isInside(filePath, `${FEATURE}/infra`)
  ) {
    if (localImport && isForbiddenRootRuntimeModule(localImport)) {
      violations.push(
        `${filePath} imports forbidden root runtime module "${specifier}"`,
      );
    }
    return;
  }

  if (
    !testFile &&
    !isInside(filePath, FEATURE) &&
    localImport &&
    isInside(localImport, FEATURE) &&
    withoutExtension(localImport) !== `${FEATURE}/index`
  ) {
    violations.push(
      `${filePath} deep-imports the get-crypto-markets feature: "${specifier}"; import "./features/get-crypto-markets/index.js" instead`,
    );
  }
};

export const checkArchitecture = async (root = DEFAULT_ROOT) => {
  const absoluteRoot = resolve(root);
  const violations = [];
  const files = await collectTypeScriptFiles(absoluteRoot);

  for (const file of files) {
    const filePath = normalize(relative(absoluteRoot, file));
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier) continue;
      inspectImport({
        file,
        filePath,
        root: absoluteRoot,
        specifier,
        violations,
      });
    }
  }

  return violations;
};

const root = process.argv[2] ?? DEFAULT_ROOT;
const violations = await checkArchitecture(root);

if (violations.length > 0) {
  process.stderr.write(
    `Trading RPC architecture violations:\n${violations.join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write('Trading RPC hexagonal dependency rule: PASS\n');
}
