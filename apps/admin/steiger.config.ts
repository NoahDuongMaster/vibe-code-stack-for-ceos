import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/__test__/**', 'src/styled-system/**', 'src/**/*.d.ts'],
  },
  {
    files: ['./src/screens/**'],
    rules: {
      // `screens` is the project's clearer name for the FSD page role.
      'fsd/insignificant-slice': 'off',
      'fsd/typo-in-layer-name': 'off',
    },
  },
  {
    files: ['./src/bootstrap/**'],
    rules: {
      // Bootstrap owns application composition and contains segments rather
      // than slices. ESLint enforces its direction and Public API boundaries.
      'fsd/no-segmentless-slices': 'off',
      'fsd/typo-in-layer-name': 'off',
    },
  },
  {
    files: ['./src/widgets/**', './src/features/**', './src/entities/**'],
    rules: {
      // Valid consumers may live in the noncanonical Screens/Bootstrap layers.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
