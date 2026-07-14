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
    // Steiger owns FSD layer direction; ESLint prevents bypassing slice and
    // segment Public APIs. Same-slice internals use relative imports.
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
      'src/widgets/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
      'src/entities/**/*.{ts,tsx}',
      'src/shared/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app/*/**',
                '!@/app/styles/global.css',
                '@/pages/*/**',
                '@/widgets/*/**',
                '@/features/*/**',
                '@/entities/*/**',
                '@/shared/api/**',
                '@/shared/config/**',
                '@/shared/model/**',
                '@/shared/routes/**',
                '@/shared/ui/**',
                '@/shared/lib/*/**',
              ],
              message:
                'Consume FSD slices and Shared/App segments through their Public API; use relative imports inside the same slice.',
            },
          ],
        },
      ],
    },
  },
);
