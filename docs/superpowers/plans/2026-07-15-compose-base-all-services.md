# Compose Base All Services Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `infra/docker/compose.yaml` the visible source of truth for all five applications plus cloudflared, while keeping staging and production limited to their existing runtime topology.

**Architecture:** Declare all six services in the base file. Mark Docker-only local services (`admin`, `landing`, and `api-gateway`) with the `dev` profile; retain the existing `vpc` profile for `trading-rpc` and `cloudflared`. The development Make targets activate both profiles, while environment overlays contain only values that actually differ by environment.

**Tech Stack:** Docker Compose v2 profiles and overlays, GNU Make, Dockerfile.

## Global Constraints

- Preserve the effective development service definitions, ports, healthchecks, commands, environment, volumes, and networks.
- Preserve staging and production effective configurations.
- Keep `make start-development` as the one-command entrypoint for five apps plus cloudflared.
- Do not expose, copy, or commit the Cloudflare Tunnel token.
- Do not add dependencies or deploy locally.

---

### Task 1: Lock current effective behavior

**Files:**
- Test artifacts: `/tmp/vibe-compose-base-refactor-{development,staging,production}.before.json`

**Interfaces:**
- Consumes: current base and environment overlays.
- Produces: machine-comparable effective Compose fixtures.

- [x] **Step 1: Capture effective JSON configurations**

```bash
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.dev.yaml \
  --profile vpc config --no-env-resolution --format json \
  > /tmp/vibe-compose-base-refactor-development.before.json
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.staging.yaml \
  --profile vpc config --no-env-resolution --format json \
  > /tmp/vibe-compose-base-refactor-staging.before.json
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.prod.yaml \
  --profile vpc config --no-env-resolution --format json \
  > /tmp/vibe-compose-base-refactor-production.before.json
```

### Task 2: Move all service declarations into the base file

**Files:**
- Modify: `infra/docker/compose.yaml`
- Modify: `infra/docker/compose.dev.yaml`

**Interfaces:**
- Consumes: the existing `admin`, `landing`, and `api-gateway` definitions.
- Produces: six explicit entries under the base `services` key.

- [x] **Step 1: Add a shared local workspace runtime extension to the base file**

Define image `vibe-workspace-dev:development`, `pull_policy: never`, `init: true`, and `restart: unless-stopped` once.

- [x] **Step 2: Move the three local-only services into the base file**

Preserve their commands, ports, env files, volumes, healthchecks, dependencies, and networks; add `profiles: [dev]` to each.

- [x] **Step 3: Reduce the development overlay**

Leave only the development overrides for `dapp` and `trading-rpc`; do not redeclare `admin`, `landing`, or `api-gateway` there.

### Task 3: Activate the complete profile set through Make

**Files:**
- Modify: `Makefile`
- Modify: `infra/docker/README.md`

**Interfaces:**
- Consumes: Compose profiles `dev` and `vpc`.
- Produces: unchanged operator commands.

- [x] **Step 1: Add one reusable development profile flag set**

Use `--profile dev --profile vpc` for full development build/start/stop/log/config commands. Keep the VPC-only commands on `--profile vpc`.

- [x] **Step 2: Document profile ownership**

State that all six services are declared in `compose.yaml`, with profiles selecting which environment runs them.

### Task 4: Verify behavior preservation

**Files:**
- Test artifacts: `/tmp/vibe-compose-base-refactor-{development,staging,production}.after.json`

**Interfaces:**
- Consumes: Task 1 fixtures.
- Produces: normalized equality evidence.

- [x] **Step 1: Capture new effective configurations**

Use both `dev` and `vpc` profiles for development, and `vpc` for staging and production.

- [x] **Step 2: Compare normalized JSON**

Remove only service-level `profiles` keys from both fixture sets, sort JSON keys, and assert exact equality for all three environments.

- [x] **Step 3: Assert base ownership**

Parse `infra/docker/compose.yaml` through Compose and assert that its service model declares exactly `dapp`, `admin`, `landing`, `api-gateway`, `trading-rpc`, and `cloudflared` across enabled profiles.

- [x] **Step 4: Run validation and quality gates**

```bash
make check-docker
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
git diff --check
```

Expected: every command exits zero.
