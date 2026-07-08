import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

// Same @cloudflare/vite-plugin the main app uses —
// gives HMR + the real workerd runtime during dev.
export default defineConfig({
  plugins: [cloudflare()],
});
