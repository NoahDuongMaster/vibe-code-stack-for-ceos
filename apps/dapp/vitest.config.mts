import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('./src/__test__/setup/cloudflare-workers.ts', import.meta.url),
      ),
    },
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'e2e/**',
    ],
    setupFiles: [
      './src/__test__/setup/matchMedia.ts',
      './src/__test__/setup/react-three-console.ts',
      './src/__test__/setup/server.ts',
      './src/__test__/setup/server-only.ts',
    ],
    coverage: {
      provider: 'v8',
      // In Vitest 4, `include` also adds matching untested files to the report,
      // so they remain visible at 0% and can fail the thresholds below.
      include: ['src/**/*.{ts,tsx}'],
      // Exclude generated code plus framework composition/UI boundaries. The
      // feature/entity thresholds below cover application logic explicitly.
      exclude: [
        'src/styled-system/**',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/bootstrap/**/index*.ts',
        'src/bootstrap/errors/**',
        'src/bootstrap/metadata/**',
        'src/bootstrap/providers/**',
        'src/screens/**/ui/**',
        'src/shared/ui/**',
        'src/__test__/**',
        '**/*.config.*',
      ],
      // AGENTS.md's coverage mandate: >=80% for feature/entity logic.
      thresholds: {
        'src/features/*/api/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/features/*/model/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
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
