import { readdirSync } from 'node:fs';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

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
];

const pageSliceNames = readdirSync(new URL('./src/_pages', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const pageSliceConfigs = pageSliceNames.map((sliceName) => ({
  files: [`src/_pages/${sliceName}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '@/_app/**',
              ...pageSliceNames
                .filter((candidate) => candidate !== sliceName)
                .flatMap((candidate) => [
                  `@/_pages/${candidate}`,
                  `@/_pages/${candidate}/**`,
                ]),
              ...sliceInternalPatterns,
            ],
            message:
              'Page slices must not import the App layer, sibling Page slices, or lower-layer internals.',
          },
        ],
      },
    ],
  },
}));

const eslintConfig = [
  {
    ignores: [
      'dist/',
      '.next/',
      'coverage/',
      'graphify-out/',
      'src/styled-system/',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['next-env.d.ts'],
    rules: {
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
                '@/_pages/*/**',
                '!@/_pages/*/index.server',
                '@/_app/*/**',
                '!@/_app/*/index.client',
                '!@/_app/*/index.server',
                '!@/_app/styles/index.css',
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
    // `_app` is the FSD App layer. Steiger 0.5 does not understand the
    // underscore required to avoid colliding with Next's root app folder, so
    // ESLint enforces public-API consumption for this layer explicitly.
    files: ['src/_app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/_pages/*/**',
                '!@/_pages/*/index.server',
                ...sliceInternalPatterns,
              ],
              message:
                'The FSD App layer must consume lower layers through public APIs.',
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
  ...pageSliceConfigs,
];

export default eslintConfig;
