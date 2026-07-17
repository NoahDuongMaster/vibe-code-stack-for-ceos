import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/**/*.d.ts'],
  },
  {
    files: ['./src/pages/**', './src/widgets/site-shell/**'],
    rules: {
      // Astro route wrappers live outside the FSD root, so Page slices and the
      // shared route shell intentionally have no in-root consumer.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
