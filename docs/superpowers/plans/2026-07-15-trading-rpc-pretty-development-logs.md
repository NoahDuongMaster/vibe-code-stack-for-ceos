# Trading RPC Pretty Development Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render readable `trading-rpc` logs in development while preserving structured JSON in every non-development environment.

**Architecture:** A pure Fastify platform helper resolves logger options from validated `nodeEnv`; the composition root injects the result into the existing server factory. `pino-pretty` remains development-only, with the Docker development overlay opting into packaging it through a build argument.

**Tech Stack:** TypeScript 6, Fastify 5/Pino, pino-pretty, Vitest 4, pnpm 11, Docker Compose.

## Global Constraints

- Only `src/index.ts` may read `process.env`.
- `development` uses `pino-pretty`; all other environment values use Pino JSON.
- Existing structured request fields and payload-redaction behavior must remain unchanged.
- `pino-pretty` must be declared in `devDependencies` and excluded from default production Docker builds.
- Do not add a new environment variable or a custom logging abstraction.

---

### Task 1: Environment-specific Fastify logger policy

**Files:**
- Create: `services/trading-rpc/src/platform/fastify/logger-options.test.ts`
- Create: `services/trading-rpc/src/platform/fastify/logger-options.ts`

**Interfaces:**
- Consumes: `nodeEnv: string` from validated runtime config.
- Produces: `resolveFastifyLoggerOptions(nodeEnv: string): FastifyServerOptions['logger']`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(resolveFastifyLoggerOptions('development')).toEqual({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:HH:MM:ss.l',
    },
  },
});
expect(resolveFastifyLoggerOptions('production')).toBe(true);
expect(resolveFastifyLoggerOptions('staging')).toBe(true);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @services/trading-rpc exec vitest run src/platform/fastify/logger-options.test.ts
```

Expected: FAIL because `logger-options.ts` does not exist yet.

- [ ] **Step 3: Add the minimal pure resolver**

```ts
import type { FastifyServerOptions } from 'fastify';

const DEVELOPMENT_LOGGER = {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:HH:MM:ss.l',
    },
  },
} satisfies FastifyServerOptions['logger'];

export const resolveFastifyLoggerOptions = (
  nodeEnv: string,
): FastifyServerOptions['logger'] =>
  nodeEnv === 'development' ? DEVELOPMENT_LOGGER : true;
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same Vitest command. Expected: all tests pass.

### Task 2: Dependency and composition-root wiring

**Files:**
- Modify: `services/trading-rpc/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `services/trading-rpc/src/index.ts`

**Interfaces:**
- Consumes: `resolveFastifyLoggerOptions(config.nodeEnv)`.
- Produces: the existing `TServerOptions.logger` injection.

- [ ] **Step 1: Install the formatter as a development dependency**

```bash
pnpm --filter @services/trading-rpc add --save-dev pino-pretty
```

- [ ] **Step 2: Inject the resolved logger into `createServer`**

```ts
import { resolveFastifyLoggerOptions } from '@/platform/fastify/logger-options';

server = await createServer({
  // existing options
  logger: resolveFastifyLoggerOptions(config.nodeEnv),
});
```

- [ ] **Step 3: Run logger and HTTP adapter tests**

```bash
pnpm --filter @services/trading-rpc exec vitest run \
  src/platform/fastify/logger-options.test.ts \
  src/adapters/http.adapter.test.ts
```

Expected: all tests pass and structured request-log assertions remain green.

### Task 3: Development-only Docker formatter

**Files:**
- Modify: `infra/docker/trading-rpc.Dockerfile`
- Modify: `infra/docker/compose.dev.yaml`

**Interfaces:**
- Consumes: Docker build argument `INCLUDE_PRETTY_LOGGER`, default `false`.
- Produces: development runtime dependencies including `pino-pretty` only when requested.

- [ ] **Step 1: Add a fail-closed Docker build argument**

Add `ARG INCLUDE_PRETTY_LOGGER=false` to the runtime dependency stage. Extend
the dependency-generation script only when the argument equals `true`, reading
the version from `pkg.devDependencies['pino-pretty']`.

- [ ] **Step 2: Enable it in the development Compose overlay**

```yaml
services:
  trading-rpc:
    build:
      args:
        INCLUDE_PRETTY_LOGGER: 'true'
```

- [ ] **Step 3: Validate merged Compose models and Dockerfiles**

```bash
make check-docker
```

Expected: all Compose configurations render and Docker build checks pass.

### Task 4: Full verification and terminal smoke test

**Files:**
- No new files.

**Interfaces:**
- Consumes: the completed application and Docker configuration.
- Produces: fresh completion evidence.

- [ ] **Step 1: Run repository quality gates**

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
```

Expected: zero errors and all tests pass.

- [ ] **Step 2: Smoke-test development output**

Start `@services/trading-rpc` with `NODE_ENV=development`, send the Connect
health request, and capture stdout. Expected: a human-readable timestamp and
`INFO: request completed`, with structured fields indented below and no raw
top-level JSON line.

- [ ] **Step 3: Smoke-test production policy**

Assert the resolver returns `true` for `production` and inspect a production
launch or Pino capture to confirm newline-delimited JSON remains enabled.

