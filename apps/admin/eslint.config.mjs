import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import reactHooks from 'eslint-plugin-react-hooks';
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

export default tseslint.config(
  // Generated / build output — never lint.
  { ignores: ['dist/**', 'src/styled-system/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Biome already governs unused imports/vars; avoid duplicate noise here.
      '@typescript-eslint/no-unused-vars': 'off',
      'no-restricted-syntax': ['error', ...absoluteImportSelectors],
    },
  },
);
