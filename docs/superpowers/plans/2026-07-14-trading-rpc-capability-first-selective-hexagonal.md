# Trading RPC Capability-First Selective Hexagonal Implementation Plan

> **For agentic workers:** Execute each task sequentially and keep the existing
> regression suite green after every structural change.

**Goal:** Convert `services/trading-rpc` into a cloneable capability-first,
selectively Hexagonal backend reference without changing runtime behavior.

**Architecture:** Keep root runtime adapters and configuration outside business
capabilities. Rename the existing operation-shaped feature to `market-data`,
retain inward dependencies inside the capability, and publish only through its
root `index.ts`.

**Tech Stack:** TypeScript 6, Fastify 5, ConnectRPC 2, Zod 4, Vitest 4, pnpm 11.

## Global Constraints

- No new dependencies.
- Do not edit generated protocol code.
- Preserve the `TradingService/GetMarkets` protobuf contract.
- Tests may deep-import the unit under test; production code may not bypass a
  capability Public API.
- Do not alter unrelated dirty worktree changes.

---

### Task 1: Lock the current behavior

**Files:** Existing `services/trading-rpc/src/**/*.test.ts` and
`services/trading-rpc/scripts/check-architecture.test.mjs`.

- [x] Run `pnpm --filter @services/trading-rpc test` and confirm 28 tests plus
  all architecture fixtures pass.
- [x] Run `pnpm --filter @services/trading-rpc typecheck`.
- [x] Run `pnpm --filter @services/trading-rpc lint:architecture`.

### Task 2: Rename the capability and operation files

**Files:**

- Move: `services/trading-rpc/src/features/get-crypto-markets/**`
- Create target: `services/trading-rpc/src/features/market-data/**`
- Rename: `application/get-crypto-markets.*` to `application/get-markets.*`
- Rename: `adapters/connect/get-crypto-markets.schema.ts` to
  `adapters/connect/get-markets.schema.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.ts`
- Modify: `services/trading-rpc/src/index.ts`

- [x] Move files with `git mv` so history remains reviewable.
- [x] Rename `GetCryptoMarkets` to `GetMarkets` and
  `GetCryptoMarketsUseCase` to `GetMarketsUseCase`.
- [x] Update imports and the capability Public API.
- [x] Run targeted Vitest and typecheck.

### Task 3: Make architecture fixtures capability-oriented

**Files:**

- Modify: `services/trading-rpc/scripts/check-architecture.test.mjs`

- [x] Replace the example feature name with `market-data`.
- [x] Keep a second capability fixture to prove automatic discovery and
  cross-capability isolation.
- [x] Run `pnpm --filter @services/trading-rpc test:architecture`.

### Task 4: Add the cloneable reference guide

**Files:**

- Create: `services/trading-rpc/src/features/README.md`

- [x] Document the complete example tree and naming conventions.
- [x] Document flat/simple and grown/Hexagonal capability shapes.
- [x] Document dependency direction, Public API rules, tests, and a clone
  checklist.
- [x] Ensure the guide does not conflict with root `AGENTS.md`.

### Task 5: Verify the completed refactor

- [x] Run `pnpm --filter @services/trading-rpc test`.
- [x] Run `pnpm --filter @services/trading-rpc typecheck`.
- [x] Run `pnpm --filter @services/trading-rpc lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm check:ci`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Review `git diff --check` and confirm unrelated changes were untouched.
