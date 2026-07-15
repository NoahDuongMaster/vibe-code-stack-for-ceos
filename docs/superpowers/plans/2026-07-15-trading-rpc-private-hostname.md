# Trading RPC Private Hostname Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register `trading-rpc.internal` as the configurable, private-only DNS name used by the Cloudflare VPC Service to reach trading-rpc.

**Architecture:** Docker Compose owns service discovery through a network-scoped alias on `trading-rpc-private`; trading-rpc application code remains unaware of deployment DNS. The API Gateway keeps the same logical Host header, while Cloudflare VPC configuration and repository documentation converge on `trading-rpc.internal:3001`.

**Tech Stack:** Docker Compose, Docker embedded DNS, Cloudflare Tunnel, Workers VPC Services, Make, Node.js validation script embedded in the Make target.

## Global Constraints

- Canonical default hostname: `trading-rpc.internal`.
- Override variable: `TRADING_RPC_PRIVATE_HOSTNAME`.
- Alias scope: `trading-rpc-private` only.
- Connect port: `3001`.
- Do not add Docker `hostname:` or trading-rpc runtime configuration.
- Do not add a direct gateway URL fallback or public exposure.

---

### Task 1: Lock and implement the Compose DNS contract

**Files:**
- Modify: `Makefile`
- Modify: `infra/docker/compose.yaml`

**Interfaces:**
- Consumes: merged Compose JSON from `compose.yaml` and `compose.dev.yaml`.
- Produces: a single `trading-rpc.internal` alias on the `trading-rpc-private` network, configurable with `TRADING_RPC_PRIVATE_HOSTNAME`.

- [x] **Step 1: Add a failing Compose contract check**

Extend `make check-docker` after the existing service-presence assertion. Pipe merged Compose JSON to Node and verify the expected alias is present only on `trading-rpc-private`:

```make
	@$(DOCKER_COMPOSE_DEV) $(DOCKER_DEV_PROFILES) config --format json | \
		node -e 'let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { const config = JSON.parse(raw); const networks = config.services?.["trading-rpc"]?.networks ?? {}; const expected = process.env.TRADING_RPC_PRIVATE_HOSTNAME || "trading-rpc.internal"; const privateAliases = networks["trading-rpc-private"]?.aliases ?? []; if (!privateAliases.includes(expected)) throw new Error(`Missing private trading-rpc alias: $${expected}`); for (const name of ["trading-rpc-data", "trading-rpc-egress"]) { if ((networks[name]?.aliases ?? []).includes(expected)) throw new Error(`Private trading-rpc alias leaked to $${name}`); } });'
```

- [x] **Step 2: Run the check and verify RED**

Run:

```bash
make check-docker
```

Expected: FAIL with `Missing private trading-rpc alias: trading-rpc.internal`.

- [x] **Step 3: Add the network-scoped alias**

Replace the short network list for trading-rpc with the expanded mapping:

```yaml
networks:
  trading-rpc-egress:
  trading-rpc-private:
    aliases:
      - ${TRADING_RPC_PRIVATE_HOSTNAME:-trading-rpc.internal}
  trading-rpc-data:
```

- [x] **Step 4: Run the check and verify GREEN**

Run:

```bash
make check-docker
```

Expected: Compose validation, private-alias assertion, and Dockerfile checks all pass.

### Task 2: Align Cloudflare and developer documentation

**Files:**
- Modify: `infra/docker/README.md`
- Modify: `services/api-gateway/wrangler.jsonc`
- Modify: `README.md`

**Interfaces:**
- Consumes: the Compose alias from Task 1.
- Produces: one documented physical VPC target, `trading-rpc.internal:3001`, while preserving the existing `TRADING_RPC` binding ID.

- [x] **Step 1: Update the physical target documentation**

Replace references to `trading-rpc:3001` as the VPC destination with
`trading-rpc.internal:3001`. Document that Compose's implicit `trading-rpc`
name remains available only as a compatibility name and that operators can
override the alias before startup:

```bash
TRADING_RPC_PRIVATE_HOSTNAME=trading-rpc.dev.internal make start-development
```

- [x] **Step 2: Update the Wrangler binding comment**

Change the development binding comment to state that the VPC Service owns the
physical target `trading-rpc.internal:3001`. Do not change `service_id`,
`binding`, or `remote`.

- [x] **Step 3: Run formatting and diff validation**

Run:

```bash
pnpm check:ci
git diff --check
```

Expected: both commands pass.

### Task 3: Verify real private DNS and traffic

**Files:**
- No source files changed.

**Interfaces:**
- Consumes: running `trading-rpc` and `cloudflared` containers attached to `trading-rpc-private`.
- Produces: runtime evidence that the alias resolves and serves HTTP from the tunnel connector's network namespace.

- [x] **Step 1: Recreate the VPC services**

Run:

```bash
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.dev.yaml \
  --profile dev --profile vpc up -d trading-rpc cloudflared
```

Expected: both containers start healthy without recreating PostgreSQL data.

- [x] **Step 2: Resolve the private hostname from cloudflared's network namespace**

Run:

```bash
docker run --rm \
  --network container:vibe-code-stack-cloudflared-1 \
  busybox:1.37 nslookup trading-rpc.internal
```

Expected: Docker DNS returns the current trading-rpc private-network address.

- [x] **Step 3: Call health through the private hostname**

Run:

```bash
docker run --rm \
  --network container:vibe-code-stack-cloudflared-1 \
  busybox:1.37 wget -qO- http://trading-rpc.internal:3001/healthz
```

Expected:

```json
{"status":"ok"}
```

- [x] **Step 4: Run the repository gates**

Run:

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
make check-docker
```

Expected: all repository and Docker gates pass.

### Task 4: Cloudflare VPC Service transition

**Files:**
- No repository files changed.

**Interfaces:**
- Consumes: the existing development VPC Service referenced by `services/api-gateway/wrangler.jsonc`.
- Produces: Cloudflare's physical VPC target points to the new Docker DNS alias.

- [x] **Step 1: Update the existing development VPC Service target**

Use Wrangler with the locally stored Cloudflare API token. Preserve the
existing service name, type, tunnel, and port while replacing only the
hostname:

```bash
CLOUDFLARE_API_TOKEN="$(cat infra/docker/secrets/cloudflare-api-token)" \
  pnpm --filter @services/api-gateway exec wrangler vpc service update \
  019f63fc-a6ec-7603-8cf9-799d6581303c \
  --name trading-rpc-development \
  --type http \
  --tunnel-id 10ad1e32-7482-4cc5-ab93-7e262c97647c \
  --hostname trading-rpc.internal \
  --http-port 3001
```

Expected: Wrangler reports a successful update. Run `wrangler vpc service get`
for the same service ID and verify `Hostname: trading-rpc.internal`.

- [x] **Step 2: Smoke-test Gateway -> VPC -> trading-rpc**

Run:

```bash
curl --fail --silent --show-error \
  -X POST http://127.0.0.1:8787/trading.v1.TradingService/GetMarkets \
  -H 'content-type: application/json' \
  -H 'connect-protocol-version: 1' \
  --data '{"coinIds":["bitcoin"],"vsCurrency":"usd"}'
```

Expected: a Connect JSON response containing a non-empty `markets` array and
`"vsCurrency":"usd"`.
