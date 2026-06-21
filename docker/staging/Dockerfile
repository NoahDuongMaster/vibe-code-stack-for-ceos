FROM node:22-slim AS base

# 1. Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# 2. Build with vinext
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY .env.staging.sample .env
RUN npx panda codegen && npm run build

# 3. Production image — run vinext standalone server
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/dist/standalone ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOST="0.0.0.0"

# Inject env vars at runtime via docker-compose env_file or -e flags
CMD ["node", "server.js"]
