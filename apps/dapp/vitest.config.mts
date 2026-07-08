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
      // Stale boilerplate previously excluded 'src/adapters/**' etc. — paths
      // that don't exist in this app's actual features/[name]/ layout, so
      // the exclusion was a silent no-op and adapters/services were being
      // measured (or not) by accident. Exclude only generated/non-logic code.
      exclude: [
        'src/styled-system/**',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
        'src/app/**/loading.tsx',
        'src/app/global-error.tsx',
        'src/app/manifest.ts',
        'src/app/robots.ts',
        'src/app/sitemap.ts',
        'src/__test__/**',
        '**/*.config.*',
      ],
      // CLAUDE.md's coverage mandate: >=80% for services and adapters.
      thresholds: {
        'src/features/*/services/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/features/*/adapters/**': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
