import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

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
