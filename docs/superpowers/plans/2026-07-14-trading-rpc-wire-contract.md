# Trading RPC Wire Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock one Protobuf casing and portable RPC error contract across
ConnectRPC and native Nest gRPC.

**Architecture:** Protobuf remains the sole wire schema. Transport adapters map
validation and domain failures to canonical status codes plus shared safe
messages; raw validator output never leaves the service.

**Tech Stack:** Protobuf, ConnectRPC 2, NestJS 11 gRPC, Zod 4, Vitest 4.

## Global Constraints

- Do not change published Protobuf field numbers or message shapes.
- Do not add REST-style success/error envelopes.
- Keep domain and application layers transport-independent.
- Add no dependencies.

---

### Task 1: Lock the public wire behavior

**Files:**
- Modify: `packages/api-core/src/index.test.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.test.ts`

**Interfaces:**
- Consumes: `ApiService`, `TradingService`, Connect and gRPC transports.
- Produces: regression coverage for exact public validation messages.

- [x] Add failing assertions that invalid Echo and GetMarkets requests expose
  stable messages instead of Zod issue text.
- [x] Run the focused tests and confirm the assertions fail on current output.

### Task 2: Centralize safe public messages

**Files:**
- Create: `packages/api-core/src/features/echo/echo.errors.ts`
- Modify: `packages/api-core/src/features/echo/echo.handler.ts`
- Modify: `packages/api-core/src/features/echo/index.ts`
- Modify: `packages/api-core/src/index.ts`
- Modify: `services/trading-rpc/src/adapters/grpc/api.grpc.controller.ts`
- Create: `services/trading-rpc/src/features/market-data/adapters/market-data.rpc-errors.ts`
- Modify: `services/trading-rpc/src/features/market-data/adapters/connect/trading-service.routes.ts`
- Modify: `services/trading-rpc/src/features/market-data/adapters/grpc/get-markets.grpc.pipe.ts`
- Modify: `services/trading-rpc/src/features/market-data/adapters/grpc/trading.grpc-exception.filter.ts`

**Interfaces:**
- Produces: shared immutable message constants consumed by both transports.

- [x] Replace validator-derived public messages with the shared constants.
- [x] Preserve canonical status-code mappings and generic internal errors.
- [x] Run focused tests and confirm they pass.

### Task 3: Verify the repository contract

**Files:**
- Modify: `services/trading-rpc/src/features/README.md`

**Interfaces:**
- Produces: developer-facing cloning and wire-contract guidance.

- [x] Run Biome, architecture lint, typecheck, unit/integration tests, and the
  production build.
- [ ] Report exact verification results and any remaining portability limits.
