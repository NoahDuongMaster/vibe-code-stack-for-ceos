# Monorepo-aware build. Build context is the repo root:
#   docker build -f infra/docker/trading-rpc.Dockerfile -t api-node .
FROM postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15 AS postgres-tools

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Install workspace deps for building (symlinked layout — fine for build-time,
#    since @packages/api-core and @packages/protocol are bundled into dist/index.js below).
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/trading-rpc/package.json ./services/trading-rpc/
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2. Build: tsup bundles @packages/api-core + @packages/protocol source directly into a
#    single dist/index.js — only true npm deps stay external.
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY packages/protocol ./packages/protocol
COPY packages/api-core ./packages/api-core
COPY services/trading-rpc ./services/trading-rpc
RUN pnpm --filter @services/trading-rpc build

# 3. Production deps: everything importable is bundled into dist/index.js by
#    tsup EXCEPT runtime-framework packages — Sentry, Nest, Fastify, grpc-js,
#    proto-loader, Drizzle/pg, reflection, and RxJS. These rely on runtime metadata,
#    dynamic loading, or native framework plugin semantics and are resolved
#    from a real node_modules at runtime. Installed in an isolated, non-
#    workspace directory so it doesn't need pnpm's monorepo/lockfile context.
FROM base AS prod-deps
WORKDIR /prod
ARG INCLUDE_PRETTY_LOGGER=false
COPY services/trading-rpc/package.json ./api-node-package.json
RUN INCLUDE_PRETTY_LOGGER="$INCLUDE_PRETTY_LOGGER" node -e "\
  const pkg = JSON.parse(require('node:fs').readFileSync('./api-node-package.json', 'utf8')); \
  const externals = [ \
    '@sentry/node', 'fastify', '@fastify/cors', '@fastify/rate-limit', \
    '@nestjs/common', '@nestjs/core', '@nestjs/microservices', \
    '@nestjs/platform-fastify', '@grpc/grpc-js', '@grpc/proto-loader', \
    'drizzle-orm', 'pg', 'reflect-metadata', 'rxjs' \
  ]; \
  if (process.env.INCLUDE_PRETTY_LOGGER === 'true') externals.push('pino-pretty'); \
  const dependencies = Object.fromEntries(externals.map((name) => [ \
    name, pkg.dependencies[name] ?? pkg.devDependencies[name] \
  ])); \
  require('node:fs').writeFileSync('package.json', JSON.stringify({ \
    name: 'api-node-runtime', private: true, dependencies \
  })); \
  require('node:fs').writeFileSync('pnpm-workspace.yaml', \
    'allowBuilds:\n  protobufjs: true\n'); \
  " \
 && pnpm install --no-frozen-lockfile

# 4. Runner — Nest/Fastify Connect endpoint plus native Nest gRPC endpoint.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 apinode && \
    adduser --system --uid 1001 apinode

COPY --from=prod-deps --chown=apinode:apinode /prod/node_modules ./node_modules
COPY --from=builder --chown=apinode:apinode /app/services/trading-rpc/dist ./dist
COPY --from=builder --chown=apinode:apinode /app/services/trading-rpc/package.json ./package.json
COPY --from=postgres-tools /usr/local/bin/gosu /usr/local/bin/gosu
COPY --chmod=0755 infra/docker/trading-rpc-entrypoint.sh /usr/local/bin/trading-rpc-entrypoint.sh

USER root

EXPOSE 3001 50051
ENV PORT=3001
ENV GRPC_PORT=50051

# LB-friendly health check for orchestrators that support it (Docker/Compose/K8s).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Real values (SENTRY_DSN, CORS_ORIGINS, MAX_BODY_BYTES, REQUEST_TIMEOUT_MS) are
# supplied at runtime via env_file/-e — none are baked into this image.
ENTRYPOINT ["/usr/local/bin/trading-rpc-entrypoint.sh"]
CMD ["node", "dist/index.js"]
