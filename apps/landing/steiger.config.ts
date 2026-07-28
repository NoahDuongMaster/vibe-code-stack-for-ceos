import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/**/*.d.ts'],
  },
  {
    files: ['./src/screens/**'],
    rules: {
      // Astro route wrappers live outside the FSD root, so Screen slices
      // intentionally have no in-root consumer.
      'fsd/insignificant-slice': 'off',
      // `screens` is the project's clearer name for the FSD page role.
      'fsd/typo-in-layer-name': 'off',
    },
  },
  {
    files: ['./src/widgets/site-shell/**'],
    rules: {
      // The shared route shell is consumed by Astro entrypoints outside src/.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
