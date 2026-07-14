import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
      // `cloudflare:workers` only exists in the workerd runtime. In Node tests
      // (which mock the DO binding and never instantiate it) alias it to a
      // minimal stand-in so the module graph loads. The production build
      // resolves the real module via @cloudflare/vite-plugin.
      {
        find: /^cloudflare:workers$/,
        replacement: fileURLToPath(
          new URL('./test/cloudflare-workers.ts', import.meta.url),
        ),
      },
    ],
  },
});
