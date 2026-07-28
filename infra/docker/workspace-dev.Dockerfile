# syntax=docker/dockerfile:1

# Shared local-development image for Cloudflare-native apps. These workspaces
# keep their framework dev servers (vinext, Rsbuild, Astro, and workerd through
# the Cloudflare Vite plugin) instead of pretending their production target is
# a generic Node container.
FROM node:22-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3

ENV PNPM_HOME="/pnpm"
ENV COREPACK_HOME="/opt/corepack"
ENV COREPACK_DEFAULT_TO_LATEST="0"
ENV HOME="/home/app"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && \
    apt-get install --yes --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p "$COREPACK_HOME" && \
    corepack enable && \
    corepack install --global pnpm@11.2.2 && \
    addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app --home "$HOME" app && \
    mkdir -p "$HOME" && \
    chown app:app "$HOME" && \
    chmod -R a+rX "$COREPACK_HOME"

WORKDIR /app

# Install from manifests first so source edits do not invalidate the dependency
# layer. All four development containers reuse this one image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/dapp/package.json ./apps/dapp/
COPY apps/landing/package.json ./apps/landing/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/api-core/package.json ./packages/api-core/
COPY packages/protocol/package.json ./packages/protocol/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/admin-rpc/package.json ./services/admin-rpc/
COPY services/trading-rpc/package.json ./services/trading-rpc/
COPY .pnpmfile.mjs ./
COPY scripts/check-install-context.ts ./scripts/

RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile --ignore-scripts

# Vite, Rsbuild, and Miniflare create development caches directly under each
# workspace's node_modules directory. Change only those directory entries;
# recursively chowning the pnpm dependency graph is both unnecessary and slow.
RUN chown app:app \
    apps/admin/node_modules \
    apps/dapp/node_modules \
    apps/landing/node_modules \
    services/api-gateway/node_modules

COPY --chown=app:app . .

USER app

CMD ["pnpm", "dev"]
