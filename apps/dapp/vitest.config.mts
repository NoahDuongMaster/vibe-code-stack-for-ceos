import react from '@vitejs/plugin-react-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), viteTsconfigPaths()],
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
      './src/__test__/setup/server.ts',
      './src/__test__/setup/server-only.ts',
    ],
    coverage: {
      provider: 'v8',
      // Without this, v8's coverage report only includes files actually
      // imported by a test run — an untested services/adapters file would
      // simply never appear in the report (and never trip the threshold
      // below) instead of failing at 0%. `all: true` reports every file
      // matched by `include`/`exclude`, tested or not.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      // Exclude generated code plus framework composition/UI boundaries. The
      // feature/entity thresholds below cover application logic explicitly.
      exclude: [
        'src/styled-system/**',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/_app/**/index*.ts',
        'src/_app/errors/**',
        'src/_app/metadata/**',
        'src/_app/providers/**',
        'src/_pages/**/ui/**',
        'src/shared/ui/**',
        'src/__test__/**',
        '**/*.config.*',
      ],
      // AGENTS.md's coverage mandate: >=80% for feature/entity logic.
      thresholds: {
        'src/features/*/{api,model}/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/entities/*/{api,model}/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
