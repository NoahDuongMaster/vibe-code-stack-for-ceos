# API Gateway VPC-Only Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Completion is tracked with checkboxes.

**Goal:** Remove the local trading URL fallback and require Cloudflare's `TRADING_RPC` VPC Service binding in code and Docker development.

**Architecture:** The Worker composition root validates the required binding and always creates the VPC adapter. Docker selects the named development environment and injects Wrangler authentication via a Git-ignored Docker secret.

**Tech Stack:** TypeScript 6, Hono 4, Cloudflare Workers VPC, Cloudflare Vite plugin, Vitest 4, Docker Compose.

## Global Constraints

- No public or Docker-network HTTP fallback from `api-gateway` to `trading-rpc`.
- No committed credentials or invented staging/production VPC Service IDs.
- Preserve feature-first selective Hexagonal boundaries.

---

### Task 1: Lock VPC-only runtime behavior

**Files:**
- Test: `services/api-gateway/src/index.test.ts`
- Test: `services/api-gateway/src/features/rpc-routing/application/route-rpc-request.use-case.test.ts`
- Modify: `services/api-gateway/src/index.ts`
- Modify: `services/api-gateway/src/adapters/cloudflare/gateway-bindings.ts`
- Modify: `services/api-gateway/src/features/rpc-routing/application/route-rpc-request.use-case.ts`

- [x] Add a failing Worker test proving a request returns the safe internal error when `TRADING_RPC` is absent.
- [x] Run the targeted test and confirm it fails because the health route currently succeeds.
- [x] Make `TRADING_RPC` required, validate it at the composition boundary, and remove the optional application endpoint.
- [x] Run the targeted tests and confirm they pass.

### Task 2: Delete URL fallback configuration

**Files:**
- Modify: `services/api-gateway/src/config/runtime-config.ts`
- Modify: `services/api-gateway/src/config/runtime-config.test.ts`
- Modify: `services/api-gateway/package.json`
- Modify: `services/api-gateway/.dev.vars.sample`
- Modify: `services/api-gateway/wrangler.jsonc`

- [x] Remove the legacy direct-URL variable, its parser, tests, and fallback
  development script.
- [x] Keep the sample focused on named-environment VPC development.
- [x] Run gateway typecheck and tests.

### Task 3: Make Docker development use the remote VPC binding

**Files:**
- Modify: `infra/docker/compose.yaml`
- Modify: `infra/docker/workspace-dev.Dockerfile`
- Modify: `.dockerignore`
- Delete: `infra/docker/api-gateway.dev.vars`
- Modify: `Makefile`
- Modify: `infra/docker/README.md`
- Modify: `README.md`
- Modify: `services/api-gateway/src/features/README.md`

- [x] Select `CLOUDFLARE_ENV=development` in the gateway container.
- [x] Mount a Git-ignored Cloudflare API token as a Docker secret and export it only inside the gateway process.
- [x] Remove the gateway from `trading-rpc-private`; VPC is the sole path.
- [x] Install the CA bundle required by `workerd` and exclude local Docker
  secrets from every image build context.
- [x] Validate Compose and smoke-test gateway-to-trading routing.

### Task 4: Repository verification

- [x] Run `pnpm typecheck`.
- [x] Run `pnpm check:ci`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
