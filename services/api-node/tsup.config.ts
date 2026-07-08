import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @repo/* workspace packages export raw TS source (no build step of their
  // own), so bundle them inline, along with @connectrpc/* (pure JS/TS, bundles
  // cleanly). @sentry/node is kept external: its OpenTelemetry auto-
  // instrumentation uses `require-in-the-middle`, which does a runtime-
  // computed `require()` esbuild cannot statically bundle — it must be
  // resolved from a real node_modules at runtime (see Dockerfile prod-deps).
  noExternal: [/^@repo\//, '@connectrpc/connect', '@connectrpc/connect-node'],
});
