import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const absoluteImportSelectors = [
  {
    selector: 'ImportDeclaration[source.value=/^\\./]',
    message: 'Use an absolute workspace alias instead of a relative import.',
  },
  {
    selector: 'ExportNamedDeclaration[source.value=/^\\./]',
    message: 'Use an absolute workspace alias instead of a relative export.',
  },
  {
    selector: 'ExportAllDeclaration[source.value=/^\\./]',
    message: 'Use an absolute workspace alias instead of a relative export.',
  },
  {
    selector: 'ImportExpression[source.value=/^\\./]',
    message: 'Use an absolute workspace alias instead of a relative import.',
  },
];

// Flat config for the Astro landing app. Mirrors the dapp's flat-config
// approach: JS recommended + typescript-eslint (non-type-checked) +
// eslint-plugin-astro's recommended flat preset. Kept pragmatic so it
// passes on the existing, working source without rewriting good code.
export default [
  {
    ignores: ['dist/', '.astro/', 'node_modules/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    files: ['astro.config.mjs', 'test/**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: [
      'astro.config.mjs',
      'astro/**/*.{ts,tsx,astro}',
      'src/**/*.{ts,tsx,astro}',
      'test/**/*.{js,mjs,cjs,ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': ['error', ...absoluteImportSelectors],
    },
  },
  {
    // Astro frontmatter imports components/data that are only referenced in
    // the template; the TS rule cannot see those uses, so it would false-flag
    // them as unused. Defer unused-var detection to `astro check` / tsc.
    files: ['**/*.astro'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
];
