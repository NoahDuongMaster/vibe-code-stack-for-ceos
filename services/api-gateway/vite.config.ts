import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

// Same @cloudflare/vite-plugin the main app uses —
// gives HMR + the real workerd runtime during dev.
export default defineConfig({
  plugins: [cloudflare()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 8787,
    strictPort: true,
  },
});
