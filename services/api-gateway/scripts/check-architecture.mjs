import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src', import.meta.url));
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const INNER_LAYER_RULES = {
  application: [
    '@/adapters/',
    '@/config/',
    '@/infra/',
    '@packages/',
    'cloudflare:workers',
    'hono',
  ],
  domain: [
    '@/adapters/',
    '@/application/',
    '@/config/',
    '@/infra/',
    '@packages/',
    'cloudflare:workers',
    'hono',
  ],
};

const FORBIDDEN_RUNTIME_IDENTIFIERS = [
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

const hasPathPrefix = (path, prefix) =>
  path === prefix || path.startsWith(`${prefix}/`);

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(path);
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) {
        return [];
      }
      return [path];
    }),
  );
  return files.flat();
};

const violations = [];

for (const [layer, forbiddenPrefixes] of Object.entries(INNER_LAYER_RULES)) {
  const layerRoot = join(ROOT, layer);
  for (const file of await collectSourceFiles(layerRoot)) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (!specifier) continue;
      const normalizedSpecifier = specifier.startsWith('.')
        ? relative(ROOT, resolve(dirname(file), specifier)).replaceAll(
            '\\',
            '/',
          )
        : specifier;
      const forbidden = forbiddenPrefixes.find((prefix) => {
        const normalizedPrefix = prefix.replace(/\/$/, '');
        const candidates = normalizedPrefix.startsWith('@/')
          ? [normalizedPrefix, normalizedPrefix.slice(2)]
          : [normalizedPrefix];
        return candidates.some((candidate) =>
          hasPathPrefix(normalizedSpecifier, candidate),
        );
      });
      if (forbidden) {
        violations.push(
          `${relative(ROOT, file)} imports forbidden outer dependency "${specifier}"`,
        );
      }
    }

    const forbiddenRuntimeIdentifier = FORBIDDEN_RUNTIME_IDENTIFIERS.find(
      (identifier) => new RegExp(`\\b${identifier}\\b`).test(source),
    );
    if (forbiddenRuntimeIdentifier) {
      violations.push(
        `${relative(ROOT, file)} references forbidden runtime identifier "${forbiddenRuntimeIdentifier}"`,
      );
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Gateway architecture violations:\n${violations.join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write('Gateway hexagonal dependency rule: PASS\n');
}
