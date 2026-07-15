# Runtime Service Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace production service-name literals in API Gateway and Trading RPC with required, validated `SERVICE_NAME` runtime configuration.

**Architecture:** Each composition root validates `SERVICE_NAME` through its existing Zod runtime-config boundary, then injects the normalized value into health-route and logging adapters. Feature/application/domain code never reads environment values, and no fallback identity is introduced.

**Tech Stack:** TypeScript 6, Zod 4, Hono 4, Cloudflare Workers bindings, NestJS 11, Fastify 5, ConnectRPC 2, Vitest 4.

## Global Constraints

- `SERVICE_NAME` is required, trimmed, and non-empty in both services.
- Production code must not provide or derive a default service name.
- API Gateway invalid bindings keep the existing safe HTTP 500 envelope.
- Trading RPC invalid environment configuration prevents startup.
- Runtime labels `node` and `cloudflare-workers` remain adapter constants.
- Add no new dependencies and do not change RPC schemas or casing.

---

### Task 1: Runtime configuration contracts

**Files:**
- Modify: `services/api-gateway/src/config/runtime-config.test.ts`
- Modify: `services/api-gateway/src/config/runtime-config.ts`
- Modify: `services/trading-rpc/src/config/runtime-config.test.ts`
- Modify: `services/trading-rpc/src/config/runtime-config.ts`

**Interfaces:**
- Produces: `TGatewayRuntimeConfig.serviceName: string`
- Produces: `TRuntimeConfig.serviceName: string`
- Consumes: raw `SERVICE_NAME` from Worker bindings or `process.env`

- [x] **Step 1: Write failing parser tests**

Add tests proving each parser trims and exposes `SERVICE_NAME`, rejects a
missing value, and rejects a whitespace-only value. Supply explicit service
names to every existing valid fixture.

```typescript
expect(parseGatewayRuntimeConfig({ SERVICE_NAME: ' edge-gateway ' }))
  .toMatchObject({ serviceName: 'edge-gateway' });
expect(() => parseGatewayRuntimeConfig({})).toThrow(/SERVICE_NAME/);

expect(parseRuntimeConfig({ SERVICE_NAME: ' trading-rpc ' }))
  .toMatchObject({ serviceName: 'trading-rpc' });
expect(() => parseRuntimeConfig({ NODE_ENV: 'development' }))
  .toThrow(/SERVICE_NAME/);
```

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @services/api-gateway exec vitest run src/config/runtime-config.test.ts
pnpm --filter @services/trading-rpc exec vitest run src/config/runtime-config.test.ts
```

Expected: failures because `serviceName` is absent and missing names are still accepted.

- [x] **Step 3: Implement required validation**

Add `SERVICE_NAME: z.string().trim().min(1)` to both Zod schemas, add the raw
binding type in Gateway, and return `serviceName` from both parsers without a
default.

- [x] **Step 4: Verify GREEN**

Run the two targeted Vitest commands again. Expected: both files pass.

### Task 2: API Gateway identity injection

**Files:**
- Modify: `services/api-gateway/src/index.test.ts`
- Modify: `services/api-gateway/src/index.ts`
- Modify: `services/api-gateway/src/adapters/http/gateway-app.ts`
- Modify: `services/api-gateway/src/adapters/http/gateway-error-handler.ts`
- Modify: `services/api-gateway/src/adapters/http/gateway-request-scope.ts`
- Modify: `services/api-gateway/src/features/rpc-routing/infra/api-core/local-api-core.adapter.ts`
- Modify: `services/api-gateway/src/features/rpc-routing/index.ts`
- Modify: `services/api-gateway/src/shared/logging/console-gateway-logger.adapter.ts`
- Modify: `services/api-gateway/src/shared/logging/index.ts`

**Interfaces:**
- Produces: `createLocalApiCoreAdapter(serviceName: string): GatewayRpcEndpoint<Request, Response>`
- Produces: `createConsoleGatewayLogger(serviceName: string): GatewayLogger`
- Produces: `GatewayRequestScope.logger: GatewayLogger`
- Consumes: `TGatewayRuntimeConfig.serviceName`

- [x] **Step 1: Write failing propagation tests**

Introduce a `gatewayBindings(overrides)` test helper that always supplies
`SERVICE_NAME: 'gateway-test'`. Add assertions that the Connect Health response
contains a custom configured name and rate-limiter warnings serialize that
same custom name. Add a missing-binding test that expects the safe 500 error.

```typescript
const res = await worker.fetch(rpcRequest(HEALTH_URL, {}),
  gatewayBindings({ SERVICE_NAME: 'custom-edge' }));
expect(await res.json()).toMatchObject({ service: 'custom-edge' });
expect(warningSpy).toHaveBeenCalledWith(
  expect.stringContaining('"service":"custom-edge"'),
);
```

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @services/api-gateway exec vitest run src/index.test.ts
```

Expected: custom health/log service-name assertions fail against singleton hardcoded adapters.

- [x] **Step 3: Implement injected factories**

Convert the local API Core endpoint and console logger to factories accepting a
validated `serviceName`. Create them inside `createRequestScope`, store the
logger on `GatewayRequestScope`, and let the error handler use that request
logger. When config parsing fails before scope creation, log generic metadata
without a fabricated service property.

- [x] **Step 4: Verify GREEN**

Run the targeted gateway test and `pnpm --filter @services/api-gateway typecheck`.
Expected: pass.

### Task 3: Trading RPC identity injection

**Files:**
- Modify: `services/trading-rpc/src/adapters/http.adapter.test.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.ts`
- Modify: `services/trading-rpc/src/adapters/grpc/api.grpc.controller.ts`
- Modify: `services/trading-rpc/src/index.ts`
- Modify: `services/trading-rpc/src/platform/nest/trading-rpc.module.ts`
- Create: `services/trading-rpc/src/platform/nest/trading-rpc.tokens.ts`
- Modify: `services/trading-rpc/src/rpc.smoke.ts`
- Modify: `services/trading-rpc/package.json`

**Interfaces:**
- Produces: required `TServerOptions.serviceName: string`
- Consumes: `TRuntimeConfig.serviceName`

- [x] **Step 1: Write failing server test**

Make the test `start()` helper pass `serviceName: 'trading-rpc-test'`, then
expect native gRPC and Connect Health responses to expose this value instead of
`api-node`.

```typescript
expect(res.service).toBe('trading-rpc-test');
```

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @services/trading-rpc exec vitest run src/adapters/http.adapter.test.ts
```

Expected: Health response still reports `api-node`.

- [x] **Step 3: Implement server propagation**

Add required `serviceName` to `TServerOptions`, pass it from `src/index.ts`, use
it in Connect `createRoutes`, and register it as an explicit Nest injection
token so native gRPC Health uses the same identity. Add it to startup
log/Sentry context, and make `rpc.smoke.ts` read it from
`parseRuntimeConfig(process.env)`. Update the smoke script to load `.env` when
present.

- [x] **Step 4: Verify GREEN**

Run the targeted adapter test and `pnpm --filter @services/trading-rpc typecheck`.
Expected: pass.

### Task 4: Runtime configuration sources and verification

**Files:**
- Modify: `services/api-gateway/.dev.vars.sample`
- Modify: `services/api-gateway/wrangler.jsonc`
- Modify: `services/trading-rpc/.env.sample`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: explicit local/staging/production configuration examples
- Consumes: required `SERVICE_NAME` contracts from Tasks 1-3

- [x] **Step 1: Add runtime values and documentation**

Add `SERVICE_NAME=api-gateway` to Gateway local/staging/production vars and
`SERVICE_NAME=trading-rpc` to the Trading RPC sample. Document that Worker
resource names and logical service identity are separate and that there is no
code fallback.

- [x] **Step 2: Run service verification**

```bash
pnpm --filter @services/api-gateway test
pnpm --filter @services/api-gateway typecheck
pnpm --filter @services/api-gateway lint
pnpm --filter @services/api-gateway build
pnpm --filter @services/trading-rpc test
pnpm --filter @services/trading-rpc typecheck
pnpm --filter @services/trading-rpc lint
pnpm --filter @services/trading-rpc build
```

Expected: all commands pass.

- [x] **Step 3: Run monorepo gates**

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
```

Expected: all CI-equivalent gates pass.
