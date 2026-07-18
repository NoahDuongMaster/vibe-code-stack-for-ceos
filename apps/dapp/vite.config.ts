import { cloudflare } from '@cloudflare/vite-plugin';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      inspectorPort: 9229,
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
  },
});
