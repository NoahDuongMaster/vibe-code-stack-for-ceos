import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.config({
    // Only rules Biome cannot handle:
    // 1. next/core-web-vitals — Next.js-specific (no-img-element, no-html-link, etc.)
    // 2. next/typescript — Next.js TS rules
    // Everything else (no-console, no-unused-vars, no-explicit-any, etc.) is covered by biome.json
    extends: ['next/core-web-vitals', 'next/typescript'],
    rules: {
      // Architecture enforcement — Biome has no equivalent of no-restricted-imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/adapters/*'],
              message:
                'Import from @/services/* instead. Adapters are called only by services.',
            },
          ],
        },
      ],
    },
    overrides: [
      {
        // Services ARE allowed to import adapters
        files: ['src/services/**/*.ts', 'src/services/**/*.tsx'],
        rules: { 'no-restricted-imports': 'off' },
      },
      {
        // Examples are teaching files — adapters allowed for illustration
        files: ['src/__examples__/**/*'],
        rules: { 'no-restricted-imports': 'off' },
      },
    ],
  }),
];

export default eslintConfig;
