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
      // Next route wrappers live outside the FSD root, so this heuristic
      // cannot see the valid external consumer of each screen slice.
      'fsd/insignificant-slice': 'off',
      // `screens` is the project's clearer name for the FSD page role.
      'fsd/typo-in-layer-name': 'off',
    },
  },
  {
    files: ['./src/bootstrap/**'],
    rules: {
      // The real Next `app/` directory lives at the workspace root. Bootstrap
      // owns application composition and its children are segments rather
      // than slices; ESLint models this project-specific layer.
      'fsd/no-segmentless-slices': 'off',
      'fsd/typo-in-layer-name': 'off',
    },
  },
  {
    files: ['./src/features/**', './src/entities/**'],
    rules: {
      // Valid consumers also live in `screens` and `bootstrap`, which Steiger
      // does not include in its canonical-layer reference count.
      // ESLint still enforces their direction and Public API boundaries.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
