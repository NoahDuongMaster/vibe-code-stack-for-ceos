import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
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
  '@/shared/config/**',
  '@/shared/seo/**',
  '@/shared/styles/**',
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
    files: [`src/screens/${sliceName}/**/*.{ts,tsx,astro}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...screenSliceNames
                  .filter((candidate) => candidate !== sliceName)
                  .flatMap((candidate) => [
                    `@/screens/${candidate}`,
                    `@/screens/${candidate}/**`,
                  ]),
                ...lowerLayerInternalPatterns,
              ],
              message:
                'Screen slices must not import sibling Screen slices or lower-layer internals.',
            },
          ],
        },
      ],
    },
  }),
);

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
    // The editor loads multiple workspace configs in one process, so the
    // parser cannot safely infer this root from the call stack.
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['astro/pages/**/*.{ts,tsx,astro}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/screens/*/**', ...lowerLayerInternalPatterns],
              message:
                'Astro route entrypoints must consume Screens and lower layers through public APIs.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '*.config.{js,mjs,cjs,ts,mts,cts}',
      'test/**/*.{js,mjs,cjs,ts,tsx}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: [
      '*.config.{ts,mts,cts}',
      'astro.config.ts',
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
  ...screenSliceConfigs,
];
