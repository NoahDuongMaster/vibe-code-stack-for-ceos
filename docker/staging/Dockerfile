# Monorepo-aware build. Build context is the repo root (see docker-compose.yml).
FROM node:26-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Install workspace deps (default symlinked layout) for building.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/dapp/package.json ./apps/dapp/
COPY apps/admin/package.json ./apps/admin/
COPY apps/landing/package.json ./apps/landing/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/api-node/package.json ./services/api-node/
COPY services/api-gateway/package.json ./services/api-gateway/
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2. Build the web app (vinext standalone) with its workspace deps.
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they MUST be
# supplied per-environment as build args — a runtime env_file cannot rewrite
# already-inlined values. SESSION_SECRET/DEMO_AUTH_* here are only build-time
# placeholders to satisfy env validation (this build process exits and a fresh
# `node server.js` process starts at runtime, so these never leak into the real
# session secret or login credential) — the real values are required at runtime
# via env_file, and the container refuses to boot without them.
ARG NEXT_PUBLIC_PROJECT_NAME=ai-first-boilerplate
ARG NEXT_PUBLIC_API_ENDPOINT=https://api.example.com
ARG NEXT_PUBLIC_BASE_URL=https://app.example.com
ARG NEXT_PUBLIC_CORS_COOKIE=example.com
ENV NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME \
    NEXT_PUBLIC_API_ENDPOINT=$NEXT_PUBLIC_API_ENDPOINT \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_CORS_COOKIE=$NEXT_PUBLIC_CORS_COOKIE \
    SESSION_SECRET=build-time-placeholder-secret-32c \
    DEMO_AUTH_EMAIL=build-time-placeholder@example.com \
    DEMO_AUTH_PASSWORD=build-time-placeholder
RUN pnpm --filter @repo/web exec panda codegen \
 && pnpm --filter @repo/web build

# 3. Flat (hoisted) node_modules for RUNTIME only — vinext's standalone server
#    keeps react/react-dom/vinext external and resolves them from a flat
#    node_modules. Isolated in its own stage so it never touches the builder.
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/dapp/package.json ./apps/dapp/
COPY apps/admin/package.json ./apps/admin/
COPY apps/landing/package.json ./apps/landing/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/api-core/package.json ./packages/api-core/
COPY services/api-node/package.json ./services/api-node/
COPY services/api-gateway/package.json ./services/api-gateway/
RUN pnpm install --frozen-lockfile --ignore-scripts --config.node-linker=hoisted

# 4. Runner — minimal image serving the vinext standalone Node server.
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Flat runtime deps first, then overlay the standalone build output on top.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/dapp/dist/standalone ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOST="0.0.0.0"

# Inject env vars at runtime via docker-compose env_file or -e flags
CMD ["node", "server.js"]
