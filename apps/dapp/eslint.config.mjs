import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

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
    // `@/features/*/server` is carved out — a second, server-only public
    // entry point (see features/auth/server.ts) for exports like
    // `getServerSession` that must NOT be re-exported from the main barrel,
    // since that barrel is also imported by Client Components and mixing
    // `server-only` code into it breaks the RSC client/server build graph.
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/**', '!@/features/*/server'],
              message:
                "app/ may only import a feature's public barrel (@/features/[name] or @/features/[name]/server) — never its internals (CLAUDE.md Hard Rule #1).",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
