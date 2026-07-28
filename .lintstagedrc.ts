import path from 'node:path';

import type { Configuration } from 'lint-staged';

// Each app below owns its own flat ESLint config — dapp, admin, and landing.
// landing has no vitest setup (static Astro site, no unit-testable client
// logic), so it only gets the eslint step.
const APPS_WITH_ESLINT_AND_TESTS = ['apps/dapp', 'apps/admin'];
const APPS_WITH_ESLINT_ONLY = ['apps/landing'];

const quoteArgument = (value: string): string => JSON.stringify(value);

const runInWorkspace = (
  dir: string,
  executable: 'eslint' | 'vitest',
  arguments_: readonly string[],
): string => {
  const command = [
    'bash',
    '-c',
    quoteArgument(`cd "$1" && shift && ./node_modules/.bin/${executable} "$@"`),
    'lint-staged',
    quoteArgument(dir),
    ...arguments_.map(quoteArgument),
  ];

  return command.join(' ');
};

const config: Configuration = {
  // Biome config lives at the repo root — safe to run on any staged file.
  '*.{js,ts,tsx,jsx,json,css}': [
    './node_modules/.bin/biome check --write --no-errors-on-unmatched',
  ],

  // Type-check affected workspaces, each with its own tsconfig (Turbo-cached, ~seconds).
  '*.{ts,tsx}': () => [
    './node_modules/.bin/tsc --project tsconfig.json --pretty false',
    './node_modules/.bin/turbo run typecheck --output-logs=full',
  ],
};

for (const dir of [...APPS_WITH_ESLINT_AND_TESTS, ...APPS_WITH_ESLINT_ONLY]) {
  config[`${dir}/**/*.{ts,tsx,js,jsx}`] = (files) =>
    runInWorkspace(dir, 'eslint', [
      '--fix',
      ...files.map((file) => path.relative(dir, path.resolve(file))),
    ]);
}

for (const dir of APPS_WITH_ESLINT_AND_TESTS) {
  config[`${dir}/**/*.{ts,tsx}`] = (files) =>
    runInWorkspace(dir, 'vitest', [
      'related',
      '--run',
      ...files.map((file) => path.relative(dir, path.resolve(file))),
    ]);
}

export default config;
