# Monorepo-aware dapp image. Build context must be the repository root:
#   docker build -f infra/docker/dapp.Dockerfile -t vibe-dapp .
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Install workspace dependencies for the build.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/dapp/package.json ./apps/dapp/
COPY apps/admin/package.json ./apps/admin/
COPY apps/landing/package.json ./apps/landing/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/trading-rpc/package.json ./services/trading-rpc/
COPY services/admin-rpc/package.json ./services/admin-rpc/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY .pnpmfile.mjs ./
COPY scripts/check-install-context.ts ./scripts/
RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile --ignore-scripts

# 2. Build the vinext standalone app with environment-specific public values.
# NEXT_PUBLIC_* values are inlined into the client bundle and therefore belong
# to the build configuration, not the runtime env_file.
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
ARG NEXT_PUBLIC_PROJECT_NAME=vibe-code-stack-for-ceos
ARG NEXT_PUBLIC_API_ENDPOINT=http://localhost:3000
ARG NEXT_PUBLIC_BASE_URL=http://localhost:3000
ARG NEXT_PUBLIC_CORS_COOKIE=localhost
ENV NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME \
    NEXT_PUBLIC_API_ENDPOINT=$NEXT_PUBLIC_API_ENDPOINT \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_CORS_COOKIE=$NEXT_PUBLIC_CORS_COOKIE
# These are non-secret builder-only validation placeholders. Keeping them scoped
# to this RUN avoids persisting secret-shaped ENV keys in an image layer.
RUN SESSION_SECRET=build-time-placeholder-secret-32c \
    DEMO_AUTH_EMAIL=build-time-placeholder@example.com \
    DEMO_AUTH_PASSWORD=build-time-placeholder \
    sh -c 'pnpm --filter @apps/dapp exec panda codegen && pnpm --filter @apps/dapp build'

# 3. Create flat runtime dependencies. vinext's standalone server keeps
# react/react-dom/vinext external and resolves them from a flat node_modules.
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/dapp/package.json ./apps/dapp/
COPY apps/admin/package.json ./apps/admin/
COPY apps/landing/package.json ./apps/landing/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/trading-rpc/package.json ./services/trading-rpc/
COPY services/admin-rpc/package.json ./services/admin-rpc/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY .pnpmfile.mjs ./
COPY scripts/check-install-context.ts ./scripts/
RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile --ignore-scripts --config.node-linker=hoisted

# 4. Run the standalone server as a non-root user. Every environment uses the
# same container port; Compose owns host-port differences.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/dapp/dist/standalone ./

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOST="0.0.0.0"

# Server-only values are injected at runtime via Compose env_file or -e flags.
CMD ["node", "server.js"]
