import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
    },
  },
  {
    // CLAUDE.md Hard Rule #4: shared/ never imports from features/ or app/.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/**', '@/app/**'],
              message:
                'shared/ must never import from features/ or app/ (CLAUDE.md Hard Rule #4).',
            },
          ],
        },
      ],
    },
  },
  {
    // CLAUDE.md Hard Rule #2: features/ import shared/ but NEVER other features.
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/**'],
              message:
                'Features never import other features — extract shared logic to shared/ instead (CLAUDE.md Hard Rule #2).',
            },
          ],
        },
      ],
    },
  },
  {
    // CLAUDE.md Hard Rule #1: app/ imports ONLY features/[name]/index.ts, never internals.
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/**'],
              message:
                "app/ may only import a feature's public barrel (@/features/[name]) — never its internals (CLAUDE.md Hard Rule #1).",
            },
          ],
        },
      ],
    },
  },
);
