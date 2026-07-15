import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @apps/*, @services/*, @packages/* workspace packages export raw TS source (no
  // build step of their own), so bundle them inline, along with @connectrpc/*
  // (pure JS/TS, bundles cleanly). Bundling connect-fastify too keeps a SINGLE
  // copy of @connectrpc/connect (a second copy from node_modules would break
  // cross-instance `instanceof ConnectError` checks). Protobuf and Zod are
  // bundled with that graph so the runtime image cannot resolve drifted copies.
  //
  // Kept EXTERNAL (installed by the prod-deps stage in
  // infra/docker/trading-rpc.Dockerfile):
  //  - @sentry/node: OpenTelemetry auto-instrumentation uses `require-in-the-
  //    middle` (runtime-computed require) that esbuild can't statically bundle.
  //  - fastify + @fastify/*: Fastify's avvio/plugin loading relies on runtime
  //    require semantics; bundling it is fragile, so we ship it as a real dep.
  noExternal: [
    /^@(apps|services|packages)\//,
    /^@bufbuild\/protobuf(?:\/.*)?$/,
    '@connectrpc/connect',
    '@connectrpc/connect-node',
    '@connectrpc/connect-fastify',
    'zod',
  ],
});
