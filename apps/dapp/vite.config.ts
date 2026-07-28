import { cloudflare } from '@cloudflare/vite-plugin';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // The only app-owned chunk above Vite's 500 kB default is the deliberately
    // lazy-loaded Three.js market scene (about 239 kB gzip). Keep a documented
    // ceiling that still warns if that isolated experience grows materially.
    chunkSizeWarningLimit: 950,
  },
  plugins: [
    vinext(),
    cloudflare({
      inspectorPort: 46009,
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 46000,
    strictPort: true,
  },
});
