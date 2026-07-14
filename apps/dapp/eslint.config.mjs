import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

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

const eslintConfig = [
  {
    ignores: [
      'dist/',
      '.next/',
      'coverage/',
      'graphify-out/',
      'e2e/',
      'src/__test__/',
      'src/styled-system/',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
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
    // `_pages` avoids activating Next's legacy Pages Router. Same-slice
    // imports stay relative; cross-slice and higher-layer imports are blocked.
    files: ['src/_pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/_app/**', '@/_pages/**', ...sliceInternalPatterns],
              message:
                'Page slices must not import the App layer, sibling Page slices, or lower-layer internals.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
