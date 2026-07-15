# Trading RPC Structured Access Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add service and operation context to Fastify access logs without logging RPC payloads.

**Architecture:** A pure Fastify platform helper parses request paths and returns child-logger bindings. The HTTP composition adapter installs it through Fastify's `childLoggerFactory`, preserving built-in request lifecycle logs.

**Tech Stack:** TypeScript 6, NestJS 11, Fastify 5/Pino, Vitest 4.

## Global Constraints

- Do not log request or response bodies.
- Read service identity only from the already validated `TServerOptions.serviceName` value.
- Preserve Fastify's existing `reqId`, response status, response time, and lifecycle messages.
- Add no dependencies.

---

### Task 1: Structured Fastify request bindings

**Files:**
- Create: `services/trading-rpc/src/platform/fastify/request-log-bindings.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.ts`
- Test: `services/trading-rpc/src/adapters/http.adapter.test.ts`

**Interfaces:**
- Consumes: validated `serviceName`, raw HTTP method, and raw URL.
- Produces: `createRequestLogBindings(serviceName, method, rawUrl)` and `createRequestChildLoggerFactory(serviceName)`.

- [ ] **Step 1: Write failing integration tests**

Assert a completed Connect request contains `serviceName`, `runtime`, `protocol`, `rpcService`, and `rpcMethod`; assert `/healthz` contains `protocol`, `httpMethod`, and `httpPath`; assert neither event has a body property.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @services/trading-rpc exec vitest run src/adapters/http.adapter.test.ts
```

Expected: the new access-log assertions fail because child log bindings are not installed.

- [ ] **Step 3: Implement the minimal binding helper and install it**

Use Fastify's request `childLoggerFactory` to return `logger.child({...bindings, ...requestContext})`. Parse Connect paths with a fully-qualified service pattern and otherwise emit plain HTTP fields.

- [ ] **Step 4: Verify GREEN and repository gates**

Run the targeted test, then `pnpm typecheck`, `pnpm check:ci`, `pnpm lint`, `pnpm test`, and `pnpm build`.
