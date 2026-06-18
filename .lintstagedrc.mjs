import { relative } from 'path';

const buildEslintCommand = (filenames) =>
  `next lint --fix --file ${filenames
    .map((f) => relative(process.cwd(), f))
    .join(' --file ')}`;

export default {
  // Biome: format + lint (replaces prettier + stylelint)
  '*.{js,ts,tsx,jsx,json,css}': ['biome check --write'],
  // ESLint: Next.js-specific rules (app router, no-html-link, etc.)
  '*.{js,ts,tsx,jsx}': [buildEslintCommand, () => 'tsc --noEmit'],
  // Run related tests
  '*.{ts,tsx}': ['vitest related --run'],
};
