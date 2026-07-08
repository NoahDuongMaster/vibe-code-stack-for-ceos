import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// The @repo/* packages ship raw TypeScript (exports ./src/index.ts), so they
// must be included in compilation — Rspack skips node_modules by default.
const packagesDir = fileURLToPath(new URL('../../packages', import.meta.url));

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: { index: './src/index.tsx' },
    include: [packagesDir],
  },
  html: {
    title: 'Admin — @repo/admin',
  },
  output: {
    distPath: { root: 'dist' },
  },
});
