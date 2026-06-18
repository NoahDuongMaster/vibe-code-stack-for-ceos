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
    ],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/adapters/**',
        'src/locales/**',
        'src/hooks/**',
        'src/components/**',
        'src/stores/**',
        'src/utils/**',
      ],
    },
  },
});
