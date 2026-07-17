import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/__test__/**', 'src/styled-system/**', 'src/**/*.d.ts'],
  },
  {
    files: ['./src/_pages/**'],
    rules: {
      // Next route wrappers live outside the FSD root, so this heuristic
      // cannot see the valid external consumer of each page slice.
      'fsd/insignificant-slice': 'off',
      // `_pages` avoids activating Next's legacy Pages Router. Steiger only
      // recognizes the unprefixed canonical layer name.
      'fsd/typo-in-layer-name': 'off',
    },
  },
  {
    files: ['./src/_app/**'],
    rules: {
      // The real Next `app/` directory lives at the workspace root. `_app`
      // is the FSD App layer, whose children are segments rather than slices;
      // Steiger 0.5 cannot model that underscored framework workaround.
      'fsd/no-segmentless-slices': 'off',
      'fsd/typo-in-layer-name': 'off',
    },
  },
  {
    files: ['./src/features/**', './src/entities/**'],
    rules: {
      // The valid consumers of these slices live in underscored `_pages` and
      // `_app` layers that Steiger 0.5 cannot include in its reference count.
      // ESLint still enforces their direction and Public API boundaries.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
