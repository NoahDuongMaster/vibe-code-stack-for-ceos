# Remove Echo RPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the diagnostic Echo RPC from the contract and all runtime/client surfaces.

**Architecture:** The Protobuf contract remains the source of truth. Delete Echo there, regenerate code, remove the now-dead api-core capability and native controller adapter, and migrate unrelated infrastructure tests to Health or GetMarkets.

**Tech Stack:** Buf/Protobuf-ES, Connect RPC 2, NestJS 11 gRPC, Fastify 5, Hono 4, Vitest 4.

## Global Constraints

- Preserve `ApiService.Health` and `TradingService.GetMarkets` wire behavior.
- Do not leave a published method without an implementation.
- Do not add a compatibility shim or new dependency.
- Generated files change only through `pnpm --filter @packages/protocol generate`.

---

### Task 1: Remove Echo from the published contract

**Files:**
- Modify: `packages/api-core/src/index.test.ts`
- Modify: `packages/api-client/src/index.test.ts`
- Modify: `packages/protocol/proto/api/v1/api.proto`
- Regenerate: `packages/protocol/src/gen/api/v1/api_pb.ts`

**Interfaces:**
- Produces an `ApiService` descriptor containing only `health`.

- [ ] Add failing assertions that generated descriptors/clients do not expose Echo.
- [ ] Run api-core and api-client tests and confirm failure on the existing Echo method.
- [ ] Delete Echo messages/method from Proto and run `pnpm --filter @packages/protocol generate`.

### Task 2: Remove implementations and migrate tests

**Files:**
- Delete: `packages/api-core/src/features/echo/*`
- Modify: `packages/api-core/src/adapters/connect/routes.ts`
- Modify: `packages/api-core/src/index.ts`
- Modify: `packages/api-core/src/index.test.ts`
- Modify: `packages/api-client/src/index.ts`
- Modify: `packages/api-client/src/index.test.ts`
- Modify: `services/trading-rpc/src/adapters/grpc/api.grpc.controller.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.test.ts`
- Modify: `services/trading-rpc/src/rpc.smoke.ts`
- Modify: `services/api-gateway/src/index.test.ts`
- Modify: `apps/admin/src/entities/user/api/user.api.ts`

**Interfaces:**
- Connect and native gRPC continue to serve Health; TradingService continues to serve GetMarkets.

- [ ] Remove Echo implementation imports, exports, handlers, tests, and examples.
- [ ] Use Health for local/public/CORS behavior and GetMarkets for protected/rate-limited/proxied behavior.
- [ ] Run focused tests for protocol consumers and both services.

### Task 3: Verify the repository

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm check:ci`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
