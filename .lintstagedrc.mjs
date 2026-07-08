import path from 'node:path';

// Each app below owns its own flat ESLint config — dapp, admin, and landing.
// landing has no vitest setup (static Astro site, no unit-testable client
// logic), so it only gets the eslint step.
const APPS_WITH_ESLINT_AND_TESTS = ['apps/dapp', 'apps/admin'];
const APPS_WITH_ESLINT_ONLY = ['apps/landing'];

// Quoted so a staged filename containing a space (or other shell-meaningful
// character) survives being embedded in the `bash -c '...'` string below as
// one argument instead of splitting apart.
const rel = (dir) => (files) =>
  files
    .map((f) => JSON.stringify(path.relative(dir, path.resolve(f))))
    .join(' ');

const config = {
  // Biome config lives at the repo root — safe to run on any staged file.
  '*.{js,ts,tsx,jsx,json,css}': [
    'biome check --write --no-errors-on-unmatched',
  ],

  // Type-check affected workspaces, each with its own tsconfig (Turbo-cached, ~seconds).
  '*.{ts,tsx}': () => 'turbo run typecheck --output-logs=errors-only',
};

for (const dir of [...APPS_WITH_ESLINT_AND_TESTS, ...APPS_WITH_ESLINT_ONLY]) {
  const toRel = rel(dir);
  config[`${dir}/**/*.{ts,tsx,js,jsx}`] = (files) =>
    `bash -c 'cd ${dir} && eslint --fix ${toRel(files)}'`;
}

for (const dir of APPS_WITH_ESLINT_AND_TESTS) {
  const toRel = rel(dir);
  config[`${dir}/**/*.{ts,tsx}`] = (files) =>
    `bash -c 'cd ${dir} && vitest related --run ${toRel(files)}'`;
}

export default config;
