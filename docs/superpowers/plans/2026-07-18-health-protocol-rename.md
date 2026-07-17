# Health Protocol Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scaffold-era `api.v1.ApiService` health contract with the domain-specific `health.v1.HealthService` contract across every runtime and consumer.

**Architecture:** The Protobuf source remains the single published contract and Buf regenerates the TypeScript descriptors. API core registers its existing transport-neutral health handler against the new descriptor; Connect clients, the Nest native gRPC host, and the Cloudflare gateway consume that descriptor or its new wire path without changing health response semantics.

**Tech Stack:** Protobuf 3, Buf 1.71, Protobuf-ES 2.12, ConnectRPC 2, NestJS 11 native gRPC, Hono 4, TypeScript 6, Vitest 4, mise, pnpm 11.

## Global Constraints

- The canonical source is `packages/protocol/proto/health/v1/health.proto` with package `health.v1` and service `HealthService`.
- Preserve `HealthRequest` and the `HealthResponse { status, service, runtime }` field names, types, and field numbers exactly.
- Change the Connect path to `/health.v1.HealthService/Health` and the native gRPC descriptor to `health.v1.HealthService`.
- Do not retain an `api.v1.ApiService` compatibility alias.
- Do not change the plain HTTP `/healthz` endpoint or `trading.v1.TradingService`.
- Never hand-edit `packages/protocol/src/gen/**`; regenerate it with Buf.
- Keep `createApiClient` and `ApiClient` as the public API-client factory/type names approved by the design.
- Do not deploy locally.
- Preserve all unrelated dirty-worktree changes.

---

## File Map

**Create/generated**

- `packages/protocol/proto/health/v1/health.proto` — canonical health contract.
- `packages/protocol/src/gen/health/v1/health_pb.ts` — Buf-generated message and service descriptors.
- `services/trading-rpc/src/adapters/grpc/health.grpc.controller.ts` — native Nest gRPC adapter for `HealthService.Health`.

**Delete/replaced**

- `packages/protocol/proto/api/v1/api.proto` — obsolete generic contract.
- `packages/protocol/src/gen/api/v1/api_pb.ts` — obsolete generated descriptor, removed by Buf's clean generation.
- `services/trading-rpc/src/adapters/grpc/api.grpc.controller.ts` — obsolete generic adapter name.

**Modify**

- `packages/protocol/src/index.ts` — export the generated health descriptor.
- `packages/api-core/src/adapters/connect/routes.ts` — register `HealthService`.
- `packages/api-core/src/index.test.ts` — assert the new descriptor and Connect path.
- `packages/api-client/src/index.ts` — build the existing public client factory from `HealthService`.
- `packages/api-client/src/index.test.ts` — assert the new path and descriptor wording.
- `services/trading-rpc/src/infra/grpc-protocol.ts` — resolve the new proto asset.
- `services/trading-rpc/src/platform/nest/trading-rpc.module.ts` — register `HealthGrpcController`.
- `services/trading-rpc/src/adapters/http.adapter.ts` — load native gRPC package `health.v1`.
- `services/trading-rpc/src/adapters/http.adapter.test.ts` — exercise the renamed Connect and gRPC services.
- `services/trading-rpc/src/rpc.smoke.ts` — construct the in-memory client from `HealthService`.
- `services/api-gateway/src/config/gateway-options.ts` — allowlist the new public health path.
- `services/api-gateway/src/index.test.ts` — send health requests to the new path.
- `apps/admin/src/shared/config/env.ts` — describe the backend as serving `HealthService`.
- `apps/admin/.env.sample` — document the same service name.
- `apps/admin/src/pages/login/api/login.api.ts` — point the future auth note at a domain-specific auth proto location.

### Task 1: Rename the canonical contract and API-core registration

**Files:**

- Create: `packages/protocol/proto/health/v1/health.proto`
- Generate: `packages/protocol/src/gen/health/v1/health_pb.ts`
- Delete: `packages/protocol/proto/api/v1/api.proto`
- Delete/generated: `packages/protocol/src/gen/api/v1/api_pb.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/api-core/src/adapters/connect/routes.ts`
- Test: `packages/api-core/src/index.test.ts`

**Interfaces:**

- Consumes: existing `healthHandler(config): Handler` from `packages/api-core/src/features/health`.
- Produces: root export `HealthService`, message types `HealthRequest` and `HealthResponse`, and Connect endpoint `/health.v1.HealthService/Health`.

- [ ] **Step 1: Change the API-core contract test first**

Replace the imported descriptor and all descriptor/path assertions in `packages/api-core/src/index.test.ts`:

```typescript
import { HealthService } from '@packages/protocol';

describe('createRoutes', () => {
  it('should expose the HealthService health method', () => {
    expect(HealthService.typeName).toBe('health.v1.HealthService');
    expect(HealthService.method).toHaveProperty('health');
  });

  const client = createClient(
    HealthService,
    createRouterTransport(createRoutes(config)),
  );
});
```

Use this exact URL in both fetch-handler suites:

```typescript
const HEALTH_PATH = 'http://localhost/health.v1.HealthService/Health';
```

- [ ] **Step 2: Run the focused test and verify the new descriptor is absent**

Run:

```bash
mise exec -- pnpm --filter @packages/api-core test
```

Expected: FAIL before production changes because `@packages/protocol` does not export `HealthService`.

- [ ] **Step 3: Replace the Protobuf source with the approved contract**

Create `packages/protocol/proto/health/v1/health.proto` with:

```proto
syntax = "proto3";

package health.v1;

// Operational health contract shared by every microservice and client.
// One source of truth, gRPC- and Connect-compatible.

message HealthRequest {}

message HealthResponse {
  string status = 1;
  string service = 2;
  string runtime = 3;
}

service HealthService {
  rpc Health(HealthRequest) returns (HealthResponse) {}
}
```

Delete `packages/protocol/proto/api/v1/api.proto`.

- [ ] **Step 4: Regenerate descriptors and update the protocol barrel**

Run:

```bash
mise exec -- pnpm --filter @packages/protocol generate
```

Expected: Buf creates `src/gen/health/v1/health_pb.ts` and removes `src/gen/api/v1/api_pb.ts` because `buf.gen.yaml` has `clean: true`.

Set `packages/protocol/src/index.ts` to export the new generated module while retaining trading:

```typescript
// Generated Protobuf-ES output (messages + service descriptors).
// Regenerate with `mise exec -- pnpm --filter @packages/protocol generate` after editing proto/.
export * from './gen/health/v1/health_pb.js';
export * from './gen/trading/v1/trading_pb.js';
```

- [ ] **Step 5: Register the existing handler against `HealthService`**

Update `packages/api-core/src/adapters/connect/routes.ts`:

```typescript
import type { ConnectRouter } from '@connectrpc/connect';
import { HealthService } from '@packages/protocol';
import { healthHandler } from '../../features/health';
import type { ApiConfig } from '../../shared/config';

/** Registers the shared health capability for every supported runtime. */
export function createRoutes(config: ApiConfig) {
  return (router: ConnectRouter) => {
    router.service(HealthService, {
      health: healthHandler({
        serviceName: config.serviceName,
        runtime: config.runtime,
      }),
    });
  };
}
```

- [ ] **Step 6: Verify the canonical contract and API core**

Run:

```bash
mise exec -- pnpm --filter @packages/protocol lint
mise exec -- pnpm --filter @packages/protocol typecheck
mise exec -- pnpm --filter @packages/api-core test
mise exec -- pnpm --filter @packages/api-core typecheck
```

Expected: all four commands PASS; the in-memory and fetch-handler health tests use `HealthService`.

- [ ] **Step 7: Commit the canonical contract task**

```bash
git add packages/protocol/proto packages/protocol/src packages/api-core/src/adapters/connect/routes.ts packages/api-core/src/index.test.ts
git commit -m "refactor(protocol): rename API health contract"
```

### Task 2: Migrate every runtime and client consumer

**Files:**

- Modify: `packages/api-client/src/index.test.ts`
- Modify: `packages/api-client/src/index.ts`
- Modify: `services/api-gateway/src/index.test.ts`
- Modify: `services/api-gateway/src/config/gateway-options.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.test.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.ts`
- Modify: `services/trading-rpc/src/infra/grpc-protocol.ts`
- Create: `services/trading-rpc/src/adapters/grpc/health.grpc.controller.ts`
- Delete: `services/trading-rpc/src/adapters/grpc/api.grpc.controller.ts`
- Modify: `services/trading-rpc/src/platform/nest/trading-rpc.module.ts`
- Modify: `services/trading-rpc/src/rpc.smoke.ts`
- Modify: `apps/admin/src/shared/config/env.ts`
- Modify: `apps/admin/.env.sample`
- Modify: `apps/admin/src/pages/login/api/login.api.ts`

**Interfaces:**

- Consumes: `HealthService` and `HealthResponse` exported by Task 1.
- Produces: Connect and native gRPC clients that call `health.v1.HealthService`; gateway authentication/rate-limit bypass for exactly `/health.v1.HealthService/Health`.

- [ ] **Step 1: Update consumer expectations before consumer implementations**

In `packages/api-client/src/index.test.ts`, set:

```typescript
const HEALTH_URL = 'http://localhost:3001/health.v1.HealthService/Health';
```

Rename the first test to:

```typescript
it('should build a client exposing the HealthService method', () => {
```

In `services/api-gateway/src/index.test.ts`, set:

```typescript
const HEALTH_URL = 'http://gateway.test/health.v1.HealthService/Health';
```

In `services/trading-rpc/src/adapters/http.adapter.test.ts`, import
`HealthService` instead of `ApiService`, use it in both `createClient` calls,
and replace every expected health descriptor/path with:

```typescript
'health.v1.HealthService'
'/health.v1.HealthService/Health'
```

- [ ] **Step 2: Run consumer tests and verify production consumers are stale**

Run:

```bash
mise exec -- pnpm --filter @packages/api-client test
mise exec -- pnpm --filter @services/api-gateway test
mise exec -- pnpm --filter @services/trading-rpc test
```

Expected: at least one focused suite FAILS because production imports, native gRPC registration, or the gateway public path still references the old service.

- [ ] **Step 3: Migrate the typed browser client without renaming its public factory**

Update `packages/api-client/src/index.ts` so its health portions are:

```typescript
import { HealthService, TradingService } from '@packages/protocol';

/**
 * End-to-end type-safe client for the shared health contract (Connect RPC).
 * Point it at any runtime serving HealthService (trading-rpc, api-gateway, …).
 */
export const createApiClient = (
  baseUrl: string,
  options?: Omit<Parameters<typeof createConnectTransport>[0], 'baseUrl'>,
): Client<typeof HealthService> =>
  createClient(HealthService, createConnectTransport({ baseUrl, ...options }));

export type ApiClient = Client<typeof HealthService>;
```

Retain `createTradingClient`, `TradingClient`, and all message-type re-exports unchanged.

- [ ] **Step 4: Migrate the gateway public path**

Set `services/api-gateway/src/config/gateway-options.ts` to:

```typescript
/** Operational paths that bypass both authentication and rate limiting. */
export const PUBLIC_PATHS = [
  '/healthz',
  '/health.v1.HealthService/Health',
] as const;
```

- [ ] **Step 5: Migrate native gRPC asset resolution and registration**

In `services/trading-rpc/src/infra/grpc-protocol.ts`, use:

```typescript
const PROTO_FILES = [
  ['health', 'v1', 'health.proto'],
  ['trading', 'v1', 'trading.proto'],
] as const;
```

In `services/trading-rpc/src/adapters/http.adapter.ts`, use:

```typescript
package: ['health.v1', 'trading.v1'],
```

Replace `api.grpc.controller.ts` with
`services/trading-rpc/src/adapters/grpc/health.grpc.controller.ts`:

```typescript
import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { healthService } from '@packages/api-core';
import { SERVICE_NAME } from '@/platform/nest/trading-rpc.tokens';

@Controller()
export class HealthGrpcController {
  constructor(@Inject(SERVICE_NAME) private readonly serviceName: string) {}

  @GrpcMethod('HealthService', 'Health')
  health() {
    return healthService.check(this.serviceName, 'node');
  }
}
```

Update `services/trading-rpc/src/platform/nest/trading-rpc.module.ts`:

```typescript
import { HealthGrpcController } from '@/adapters/grpc/health.grpc.controller';
```

and register:

```typescript
controllers: [HealthGrpcController, HealthController],
```

- [ ] **Step 6: Migrate the smoke client and documentation comments**

In `services/trading-rpc/src/rpc.smoke.ts`, import `HealthService` and construct:

```typescript
const client = createClient(HealthService, transport);
```

Change the admin env comments to “backend serving `HealthService`”. Change the
future authentication comment in `apps/admin/src/pages/login/api/login.api.ts`
to reference:

```text
packages/protocol/proto/auth/v1/auth.proto
```

- [ ] **Step 7: Verify all migrated consumers**

Run:

```bash
mise exec -- pnpm --filter @packages/api-client test
mise exec -- pnpm --filter @packages/api-client typecheck
mise exec -- pnpm --filter @services/api-gateway test
mise exec -- pnpm --filter @services/api-gateway typecheck
mise exec -- pnpm --filter @services/trading-rpc test
mise exec -- pnpm --filter @services/trading-rpc typecheck
```

Expected: every command PASS, including native gRPC health and Connect health path tests.

- [ ] **Step 8: Commit the consumer migration**

```bash
git add packages/api-client/src services/api-gateway/src services/trading-rpc/src apps/admin/.env.sample apps/admin/src/shared/config/env.ts apps/admin/src/pages/login/api/login.api.ts
git commit -m "refactor(rpc): migrate consumers to HealthService"
```

### Task 3: Prove cleanup, architecture, and production builds

**Files:**

- Verify only; fix only files already listed in Tasks 1–2 if a gate exposes a stale reference or formatting issue.

**Interfaces:**

- Consumes: the complete `health.v1.HealthService` migration from Tasks 1–2.
- Produces: a repository with no executable reference to `api.v1.ApiService` and all definition-of-done gates green.

- [ ] **Step 1: Verify no obsolete contract reference remains**

Run:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!docs/superpowers/**' --glob '!.git/**' 'ApiService|api\.v1|api_pb|proto/api/v1/api\.proto|api\.grpc\.controller' packages apps services
```

Expected: exit code 1 with no matches.

Verify the new contract is referenced where expected:

```bash
rg -n 'HealthService|health\.v1|health_pb|health\.proto' packages apps services
```

Expected: matches in the canonical proto, generated descriptor, API core,
client, trading-rpc, gateway, tests, and admin documentation comments.

- [ ] **Step 2: Verify generated code is reproducible**

Run:

```bash
mise exec -- pnpm --filter @packages/protocol generate:check
```

Expected: PASS with no generated diff.

- [ ] **Step 3: Run all backend architecture checks after the structural rename**

Run:

```bash
mise exec -- pnpm --filter @packages/api-core lint:architecture
mise exec -- pnpm --filter @services/trading-rpc lint:architecture
mise exec -- pnpm --filter @services/api-gateway lint:architecture
```

Expected: all three commands PASS.

- [ ] **Step 4: Run the repository definition-of-done gates sequentially**

Run:

```bash
mise run typecheck
mise run check:ci
mise run lint
mise run test
mise run build
```

Expected: all five commands PASS. If a failure is caused by an unrelated
pre-existing dirty-worktree change, reproduce it without the health-contract
files and report it separately instead of modifying unrelated code.

- [ ] **Step 5: Review the final change set**

Run:

```bash
git diff --check HEAD~2..HEAD
git status --short
```

Expected: no whitespace errors; only the pre-existing unrelated worktree
changes remain uncommitted. Do not deploy.
