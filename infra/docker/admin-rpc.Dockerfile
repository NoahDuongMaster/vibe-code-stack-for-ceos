# Monorepo-aware build. Build context is the repository root.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

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
WORKDIR /prod
ARG INCLUDE_PRETTY_LOGGER=false
COPY services/admin-rpc/package.json ./admin-rpc-package.json
RUN INCLUDE_PRETTY_LOGGER="$INCLUDE_PRETTY_LOGGER" node -e "\
  const pkg = JSON.parse(require('node:fs').readFileSync('./admin-rpc-package.json', 'utf8')); \
  const externals = [ \
    '@sentry/node', 'fastify', '@fastify/cors', '@fastify/rate-limit', \
    '@nestjs/common', '@nestjs/core', '@nestjs/microservices', \
    '@nestjs/platform-fastify', '@grpc/grpc-js', '@grpc/proto-loader', \
    'reflect-metadata', 'rxjs' \
  ]; \
  if (process.env.INCLUDE_PRETTY_LOGGER === 'true') externals.push('pino-pretty'); \
  const dependencies = Object.fromEntries(externals.map((name) => [ \
    name, pkg.dependencies[name] ?? pkg.devDependencies[name] \
  ])); \
  require('node:fs').writeFileSync('package.json', JSON.stringify({ \
    name: 'admin-rpc-runtime', private: true, dependencies \
  })); \
  require('node:fs').writeFileSync('pnpm-workspace.yaml', \
    'allowBuilds:\n  protobufjs: true\n'); \
  " \
 && pnpm install --no-frozen-lockfile

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 admin-rpc && \
    adduser --system --uid 1001 --ingroup admin-rpc admin-rpc

COPY --from=prod-deps --chown=admin-rpc:admin-rpc /prod/node_modules ./node_modules
COPY --from=builder --chown=admin-rpc:admin-rpc /app/services/admin-rpc/dist ./dist
COPY --from=builder --chown=admin-rpc:admin-rpc /app/services/admin-rpc/package.json ./package.json

USER admin-rpc

EXPOSE 3001 50051
ENV PORT=3001
ENV GRPC_PORT=50051

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
