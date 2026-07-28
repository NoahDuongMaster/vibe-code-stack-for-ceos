import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__test__/setup/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/styled-system/**',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/bootstrap/**',
        'src/screens/**/ui/**',
        'src/shared/ui/**',
        'src/__test__/**',
        '**/*.config.*',
      ],
      thresholds: {
        'src/entities/*/api/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/entities/*/model/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
