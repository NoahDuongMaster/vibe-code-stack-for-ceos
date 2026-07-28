# Monorepo-aware build. Build context is the repo root:
#   docker build -f infra/docker/trading-rpc.Dockerfile -t trading-rpc .
FROM postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15 AS postgres-tools

FROM node:26-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS base
ENV PNPM_HOME="/pnpm"
ENV COREPACK_DEFAULT_TO_LATEST="0"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack install --global pnpm@11.2.2

# 1. Install workspace deps for building (symlinked layout — fine for build-time,
#    since @packages/api-core and @packages/protocol are bundled into dist/index.js below).
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/trading-rpc/package.json ./services/trading-rpc/
COPY .pnpmfile.mjs ./
COPY scripts/check-install-context.ts ./scripts/
RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile --ignore-scripts

# 2. Build: tsup bundles @packages/api-core + @packages/protocol source directly into a
#    single dist/index.js — only true npm deps stay external.
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY packages/protocol ./packages/protocol
COPY packages/api-core ./packages/api-core
COPY services/trading-rpc ./services/trading-rpc
RUN pnpm --filter @services/trading-rpc build

# 3. Production dependencies use the repository lockfile and override policy.
#    A hoisted filtered install gives the bundled service a flat runtime
#    node_modules without resolving fresh semver ranges during an image build.
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/trading-rpc/package.json ./services/trading-rpc/
COPY .pnpmfile.mjs ./
COPY scripts/check-install-context.ts ./scripts/
RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile --prod --ignore-scripts \
    --filter @services/trading-rpc... --config.node-linker=hoisted

# 4. Runner — Nest/Fastify Connect endpoint plus native Nest gRPC endpoint.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 trading-rpc && \
    adduser --system --uid 1001 trading-rpc

COPY --from=prod-deps --chown=trading-rpc:trading-rpc /app/node_modules ./node_modules
COPY --from=builder --chown=trading-rpc:trading-rpc /app/services/trading-rpc/dist ./dist
COPY --from=builder --chown=trading-rpc:trading-rpc /app/services/trading-rpc/package.json ./package.json
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
