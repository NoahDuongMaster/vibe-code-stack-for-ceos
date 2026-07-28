import { readdirSync } from 'node:fs';
import js from '@eslint/js';
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

const lowerLayerInternalPatterns = [
  '@/widgets/*/**',
  '@/features/*/**',
  '@/entities/*/**',
  '@/shared/api/**',
  '@/shared/config/**',
  '@/shared/model/**',
  '@/shared/routes/**',
  '@/shared/ui/**',
  '@/shared/lib/*/**',
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
                ...lowerLayerInternalPatterns,
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

export default tseslint.config(
  // Generated / build output — never lint.
  { ignores: ['dist/**', 'src/styled-system/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],

  {
    // The editor loads multiple workspace configs in one process, so the
    // parser cannot safely infer this root from the call stack.
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
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
  {
    files: ['src/bootstrap/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/screens/*/**', ...lowerLayerInternalPatterns],
              message:
                'Bootstrap must consume Screens and lower layers through public APIs.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...screenSliceConfigs,
);
