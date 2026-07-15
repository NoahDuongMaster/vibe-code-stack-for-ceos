# Flatten Docker Compose Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the nested Docker environment folders with a flat, conventional Compose layout while preserving the complete five-app plus cloudflared development stack.

**Architecture:** Keep one canonical `compose.yaml` and colocate environment overlays as `compose.dev.yaml`, `compose.staging.yaml`, and `compose.prod.yaml`. Keep Dockerfiles and the development gateway bindings beside those Compose files so operators can discover the entire container surface in one directory.

**Tech Stack:** Docker Compose v2, GNU Make, Dockerfile, Cloudflare cloudflared.

## Global Constraints

- Preserve all effective services, networks, ports, healthchecks, environment files, Docker secrets, profiles, and image build contexts.
- Keep `infra/docker` as the only Docker definition directory.
- Keep the Cloudflare Tunnel token outside Git and never print or copy its value.
- Do not add dependencies or deploy from the local machine.

---

### Task 1: Lock the current Compose behavior

**Files:**
- Test artifact: `/tmp/vibe-compose-{development,staging,production}.before.yaml`

**Interfaces:**
- Consumes: existing nested Compose files.
- Produces: normalized effective configurations used as regression fixtures.

- [x] **Step 1: Capture each effective Compose configuration**

```bash
for environment in development staging production; do
  docker compose \
    -f infra/docker/compose.yml \
    -f "infra/docker/${environment}/compose.yml" \
    --profile vpc config --no-env-resolution \
    > "/tmp/vibe-compose-${environment}.before.yaml"
done
```

- [x] **Step 2: Confirm the development fixture contains the complete stack**

```bash
docker compose \
  -f infra/docker/compose.yml \
  -f infra/docker/development/compose.yml \
  --profile vpc config --services
```

Expected: `dapp`, `admin`, `landing`, `api-gateway`, `trading-rpc`, and `cloudflared` are all present.

### Task 2: Flatten and rename the Docker files

**Files:**
- Rename: `infra/docker/compose.yml` → `infra/docker/compose.yaml`
- Rename: `infra/docker/development/compose.yml` → `infra/docker/compose.dev.yaml`
- Rename: `infra/docker/staging/compose.yml` → `infra/docker/compose.staging.yaml`
- Rename: `infra/docker/production/compose.yml` → `infra/docker/compose.prod.yaml`
- Rename: `infra/docker/development/api-gateway.dev.vars` → `infra/docker/api-gateway.dev.vars`

**Interfaces:**
- Consumes: Task 1 regression fixtures.
- Produces: one flat Docker operations directory.

- [x] **Step 1: Move the files without changing their content**

```bash
mv infra/docker/compose.yml infra/docker/compose.yaml
mv infra/docker/development/compose.yml infra/docker/compose.dev.yaml
mv infra/docker/staging/compose.yml infra/docker/compose.staging.yaml
mv infra/docker/production/compose.yml infra/docker/compose.prod.yaml
mv infra/docker/development/api-gateway.dev.vars infra/docker/api-gateway.dev.vars
rmdir infra/docker/development infra/docker/staging infra/docker/production
```

- [x] **Step 2: Update the gateway bind source**

In `infra/docker/compose.dev.yaml`, replace `./development/api-gateway.dev.vars` with `./api-gateway.dev.vars`.

### Task 3: Update operator entrypoints and documentation

**Files:**
- Modify: `Makefile`
- Modify: `infra/docker/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the flat filenames from Task 2.
- Produces: stable `make start-development`, staging, production, logging, and validation commands.

- [x] **Step 1: Define the four Compose filenames once in Make**

Use `compose.yaml`, `compose.dev.yaml`, `compose.staging.yaml`, and `compose.prod.yaml`; remove every nested `*/compose.yml` reference.

- [x] **Step 2: Update all documented commands and layout descriptions**

Document the flat files explicitly and keep `make start-development` as the normal full-stack entrypoint.

### Task 4: Prove behavior preservation

**Files:**
- Test artifact: `/tmp/vibe-compose-{development,staging,production}.after.yaml`

**Interfaces:**
- Consumes: Task 1 fixtures and Task 2 flat Compose files.
- Produces: evidence that only the relocated gateway vars source path changed.

- [x] **Step 1: Generate the new effective configurations**

```bash
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.dev.yaml \
  --profile vpc config --no-env-resolution > /tmp/vibe-compose-development.after.yaml
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.staging.yaml \
  --profile vpc config --no-env-resolution > /tmp/vibe-compose-staging.after.yaml
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.prod.yaml \
  --profile vpc config --no-env-resolution > /tmp/vibe-compose-production.after.yaml
```

- [x] **Step 2: Normalize the intentional file relocation and compare**

```bash
sed 's#infra/docker/development/api-gateway.dev.vars#infra/docker/api-gateway.dev.vars#g' \
  /tmp/vibe-compose-development.before.yaml > /tmp/vibe-compose-development.normalized.yaml
diff -u /tmp/vibe-compose-development.normalized.yaml /tmp/vibe-compose-development.after.yaml
diff -u /tmp/vibe-compose-staging.before.yaml /tmp/vibe-compose-staging.after.yaml
diff -u /tmp/vibe-compose-production.before.yaml /tmp/vibe-compose-production.after.yaml
```

Expected: all comparisons are empty.

- [x] **Step 3: Run repository Docker validation**

```bash
make check-docker
git diff --check
```

Expected: both commands exit zero.

### Task 5: Run the repository quality gates

**Files:** None.

**Interfaces:**
- Consumes: completed refactor.
- Produces: final verification evidence.

- [x] **Step 1: Run all required gates**

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
```

Expected: every command exits zero.
