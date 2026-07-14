import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/**/*.d.ts'],
  },
  {
    files: [
      './src/pages/**',
      './src/widgets/feature-overview/**',
      './src/widgets/marketing-hero/**',
      './src/widgets/site-shell/**',
      './src/widgets/tech-stack/**',
    ],
    rules: {
      // Astro route wrappers live outside the FSD root. The home-only widgets
      // are independent page blocks, so a single in-root consumer is valid.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
