import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/create-deploy-config.test.ts'],
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
      {
        find: '@scripts',
        replacement: fileURLToPath(new URL('./scripts', import.meta.url)),
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
