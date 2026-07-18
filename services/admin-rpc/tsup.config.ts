import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle workspace packages and the complete Connect/Protobuf graph so the
  // runtime uses one ConnectError implementation. Nest, Fastify, Sentry, and
  // native gRPC stay external because they rely on runtime loading/metadata.
  noExternal: [
    /^@(apps|services|packages)\//,
    /^@bufbuild\/protobuf(?:\/.*)?$/,
    '@connectrpc/connect',
    '@connectrpc/connect-node',
    '@connectrpc/connect-fastify',
    'zod',
  ],
});
