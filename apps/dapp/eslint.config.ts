import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import pluginQuery from '@tanstack/eslint-plugin-query';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import type { ConfigWithExtends } from 'typescript-eslint';
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

const sliceInternalPatterns = [
  '@/widgets/*/**',
  '@/features/*/**',
  '!@/features/*/index.server',
  '@/entities/*/**',
  '!@/entities/*/index.client',
  '!@/entities/*/index.server',
  '@/shared/api/**',
  '!@/shared/api/index.server',
  '@/shared/config/**',
  '@/shared/routes/**',
  '@/shared/ui/**',
  '!@/shared/ui/index.client',
  '@/shared/lib/*/**',
  '!@/shared/lib/*/index.server',
];

const screenSliceNames = readdirSync(
  new URL('./src/screens', import.meta.url),
  {
    withFileTypes: true,
  },
)
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const screenSliceConfigs: ConfigWithExtends[] = screenSliceNames.map(
  (sliceName) => ({
    files: [`src/screens/${sliceName}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/bootstrap/**',
                ...screenSliceNames
                  .filter((candidate) => candidate !== sliceName)
                  .flatMap((candidate) => [
                    `@/screens/${candidate}`,
                    `@/screens/${candidate}/**`,
                  ]),
                ...sliceInternalPatterns,
              ],
              message:
                'Screen slices must not import Bootstrap, sibling Screen slices, or lower-layer internals.',
            },
          ],
        },
      ],
    },
  }),
);

const eslintConfig = tseslint.config(
  {
    ignores: [
      'dist/',
      '.next/',
      'coverage/',
      'graphify-out/',
      'src/styled-system/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],
  nextPlugin.configs['core-web-vitals'],
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['next-env.d.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'off',
      'no-restricted-syntax': ['error', ...absoluteImportSelectors],
    },
  },
  {
    files: [
      'app/**/*.{ts,tsx}',
      'proxy.ts',
      'instrumentation.ts',
      'instrumentation-client.ts',
      'sentry.*.config.ts',
      'next.config.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/screens/*/**',
                '!@/screens/*/index.server',
                '@/bootstrap/*/**',
                '!@/bootstrap/*/index.client',
                '!@/bootstrap/*/index.server',
                '!@/bootstrap/styles/index.css',
                ...sliceInternalPatterns,
              ],
              message:
                'Next entrypoints must consume FSD slices and segments through public APIs.',
            },
          ],
        },
      ],
    },
  },
  {
    // `bootstrap` is the application-composition layer. It is intentionally
    // named differently from Next's root `app/`, so ESLint enforces its
    // public-API consumption explicitly.
    files: ['src/bootstrap/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/screens/*/**',
                '!@/screens/*/index.server',
                ...sliceInternalPatterns,
              ],
              message:
                'Bootstrap must consume lower layers through public APIs.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['e2e/**/*.{ts,tsx}', 'src/__test__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  ...screenSliceConfigs,
);

export default eslintConfig;
