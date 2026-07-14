import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/__test__/**', 'src/styled-system/**', 'src/**/*.d.ts'],
  },
]);
