# Monorepo-aware build. Build context is the repository root.
FROM node:26-slim@sha256:715e55e4b84e4bb0ff48e49b398a848f08e55daed8eb6a0ea1839ae53bc57583 AS base
ENV PNPM_HOME="/pnpm"
ENV COREPACK_DEFAULT_TO_LATEST="0"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack install --global pnpm@11.2.2

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/admin-rpc/package.json ./services/admin-rpc/
COPY .pnpmfile.mjs ./
COPY scripts/check-install-context.ts ./scripts/
RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY packages/protocol ./packages/protocol
COPY packages/api-core ./packages/api-core
COPY services/admin-rpc ./services/admin-rpc
RUN pnpm --filter @services/admin-rpc build

FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/admin-rpc/package.json ./services/admin-rpc/
COPY .pnpmfile.mjs ./
COPY scripts/check-install-context.ts ./scripts/
RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile --prod --ignore-scripts \
    --filter @services/admin-rpc... --config.node-linker=hoisted

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 admin-rpc && \
    adduser --system --uid 1001 --ingroup admin-rpc admin-rpc

COPY --from=prod-deps --chown=admin-rpc:admin-rpc /app/node_modules ./node_modules
COPY --from=builder --chown=admin-rpc:admin-rpc /app/services/admin-rpc/dist ./dist
COPY --from=builder --chown=admin-rpc:admin-rpc /app/services/admin-rpc/package.json ./package.json

USER admin-rpc

EXPOSE 3001 50051
ENV PORT=3001
ENV GRPC_PORT=50051

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
