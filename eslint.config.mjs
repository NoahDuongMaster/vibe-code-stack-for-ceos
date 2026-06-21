import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: [
      'dist/',
      '.next/',
      'graphify-out/',
      'e2e/',
      'src/__test__/',
      'src/styled-system/',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
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
  },
  {
    files: ['src/services/**/*.ts', 'src/services/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/__examples__/**/*'],
    rules: { 'no-restricted-imports': 'off' },
  },
];

export default eslintConfig;
