# API Gateway Development Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add readable development access logs to `api-gateway` while retaining structured JSON outside development.

**Architecture:** Extend the existing logging port with a typed `request_completed` event, format it through the existing console adapter, and emit it from a thin Hono middleware. The composition root owns the environment-to-format decision.

**Tech Stack:** TypeScript 6, Hono 4, Cloudflare Workers, Vitest 4, Biome 2.

## Global Constraints

- Add no runtime dependency.
- Pretty output is selected only by `ENVIRONMENT=development`.
- Staging, production, and unknown environments use structured JSON.
- Never log bodies, query values, credentials, bindings, or raw error messages.
- Implement test-first and keep feature/public API boundaries intact.

---

### Task 1: Logger formatting contract

**Files:**
- Modify: `services/api-gateway/src/shared/logging/gateway-logger.port.ts`
- Create: `services/api-gateway/src/shared/logging/console-gateway-logger.adapter.test.ts`
- Modify: `services/api-gateway/src/shared/logging/console-gateway-logger.adapter.ts`

**Interfaces:**
- Produces: `GatewayLogger.info(requestCompletedEvent)`.
- Produces: `createConsoleGatewayLogger(serviceName, format)` where format is `pretty | json`.

- [ ] Write tests proving development emits a readable line and production emits parseable JSON.
- [ ] Run the focused test and verify it fails because the new API/event does not exist.
- [ ] Add the typed event and minimal serializer/formatter.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Hono request access logging

**Files:**
- Create: `services/api-gateway/src/adapters/http/middleware/request-logging.middleware.ts`
- Modify: `services/api-gateway/src/adapters/http/gateway-app.ts`
- Modify: `services/api-gateway/src/index.ts`
- Modify: `services/api-gateway/src/index.test.ts`

**Interfaces:**
- Consumes: request-scoped `GatewayLogger` and Hono request ID.
- Emits: one `request_completed` event after the downstream response resolves.

- [ ] Add integration tests for readable development output and structured production output without query values.
- [ ] Run the integration tests and verify RED because no access log exists.
- [ ] Implement and register the middleware; select format from validated runtime config.
- [ ] Re-run the integration tests and verify GREEN.

### Task 3: Verification and smoke test

**Files:**
- No additional files.

**Interfaces:**
- Produces: fresh quality-gate and runtime evidence.

- [ ] Run `pnpm --filter @services/api-gateway test`.
- [ ] Run `pnpm --filter @services/api-gateway typecheck`.
- [ ] Run `pnpm --filter @services/api-gateway lint`.
- [ ] Run `pnpm --filter @services/api-gateway build`.
- [ ] Restart the development gateway, send `/healthz`, and verify the terminal output is readable rather than raw JSON.
