# Mise Native Development Topology Design

**Date:** 2026-07-17

**Status:** Approved for implementation

## Problem

`mise run dev` currently delegates directly to `turbo run dev`. Turbo starts the
five application processes, but it does not provision their runtime
dependencies or reserve non-conflicting development ports.

The current command fails deterministically for three reasons:

1. Native `trading-rpc` reads its validated `DATABASE_URL` from
   `services/trading-rpc/.env` and connects to PostgreSQL on
   `127.0.0.1:5433`, but the root dev task does not start PostgreSQL.
2. Dapp and API gateway both use `@cloudflare/vite-plugin`. The plugin enables
   debugging on inspector port `9229` by default, so concurrent startup causes
   one Worker runtime to fail with `EADDRINUSE`.
3. Rsbuild defaults the admin dev server to port `3000`, which races with the
   dapp's canonical port.

The quick-start contract says `mise run dev` starts the whole development
system, so requiring undocumented manual infrastructure startup is a product
bug rather than a user setup error.

## Goals

- Make `mise run dev` start a working integration topology with native
  hot-reload processes.
- Keep the API gateway's mandatory remote Workers VPC binding; do not add a
  direct-URL fallback.
- Keep public development orchestration in mise and low-level Compose commands
  in the root Makefile.
- Give every native HTTP, gRPC, and Worker inspector listener a stable,
  non-conflicting port.
- Preserve focused tasks such as `dev:web`, `dev:api`, and `dev:gateway`.
- Provide an explicit mise command to stop the Docker infrastructure started
  for native development.

## Non-goals

- Do not change staging or production topology.
- Do not deploy or modify the remote Cloudflare VPC Service.
- Do not introduce a gateway fallback to a public or localhost RPC URL.
- Do not make Docker application containers hot-reload source code.
- Do not automatically delete PostgreSQL data when native dev stops.

## Approaches Considered

### 1. Hybrid native applications plus Docker VPC infrastructure — selected

Mise provisions PostgreSQL, the VPC-visible trading-rpc origin, and cloudflared
before Turbo starts native application processes. This preserves native HMR,
keeps the gateway on its production-shaped VPC path, and gives one root command
the dependencies it actually needs.

The trade-off is that trading-rpc runs twice during the full topology: the
container is the origin reached through the remote VPC binding, while the
native process provides direct hot reload on localhost. The container image is
rebuilt when the infrastructure starts; edits made during the session affect
the native process immediately but require restarting `dev:infra` before they
are visible through the gateway path.

### 2. Make `dev` an alias for the full Docker stack — rejected

This gives the simplest network topology, but it discards the established
native hot-reload workflow and duplicates `docker:start`. The development
containers currently build source into images rather than bind-mounting the
whole repository, so this is unsuitable as the default coding loop.

### 3. Route the local gateway directly to native trading-rpc — rejected

This would avoid the origin container and Tunnel, but it violates the hard
architecture rule that the gateway uses a Workers VPC `Fetcher` binding and
fails closed when that binding is unavailable. A local-only transport fallback
would create behavior that cannot exist in staging or production.

## Command Contract

### Full native development

`mise run dev` depends on `dev:infra`, then runs the existing Turbo `dev` graph
for dapp, admin, landing, API gateway, and native trading-rpc.

### Infrastructure tasks

- `mise run dev:database` starts only the development PostgreSQL container.
- `mise run dev:infra` starts PostgreSQL, the VPC trading-rpc container, and
  cloudflared. It rebuilds the origin image before startup.
- `mise run dev:infra:stop` stops and removes those three infrastructure
  containers without deleting persistent PostgreSQL data.

Docker Compose commands remain in Make targets. Mise tasks only delegate to
those targets.

### Focused application tasks

- `dev:web`, `dev:admin`, and `dev:landing` remain native app-only commands.
- `dev:api` depends on `dev:database` because native trading-rpc requires
  PostgreSQL but not the VPC connector.
- `dev:gateway` depends on `dev:infra` because its remote VPC binding targets
  the containerized origin.
- `dev:backend` depends on `dev:infra` and continues to run the local gateway
  plus native trading-rpc. The gateway exercises the containerized VPC origin;
  the native RPC process remains available for direct development.

## Runtime Topology And Ports

| Runtime | Listener | Port |
| --- | --- | ---: |
| dapp native server | HTTP | `3000` |
| dapp Worker debugger | inspector | `9229` |
| admin native server | HTTP | `3002` |
| landing native server | HTTP | `4321` |
| API gateway native server | HTTP | `8787` |
| API gateway Worker debugger | inspector | `9230` |
| native trading-rpc | Connect HTTP | `3001` |
| native trading-rpc | gRPC | `50051` |
| VPC origin container | Connect HTTP, host-published | `3003` |
| VPC origin container | gRPC, host-published for native topology | `50052` |
| PostgreSQL container | PostgreSQL, loopback-only | `5433` |

The regular full Docker topology retains its existing trading-rpc gRPC host
port `50051`. Only the native-development infrastructure target overrides the
container's host mapping to `50052`, avoiding collision with native
trading-rpc.

Admin, API gateway, and both Worker inspector ports use strict port behavior.
Startup must fail with a clear address-in-use error rather than silently move a
service to an undocumented port.

## Startup And Shutdown Flow

1. Mise resolves the `dev:infra` dependency before `dev`.
2. The Make target validates the existing Cloudflare Tunnel token.
3. Compose builds and starts PostgreSQL, waits for its health condition before
   starting the VPC origin, and starts cloudflared.
4. Mise starts the Turbo dev graph after the infrastructure command succeeds.
5. Turbo owns and terminates the five native processes when the user presses
   Ctrl-C.
6. Docker infrastructure intentionally remains available for fast restarts and
   persistent data. The user stops it explicitly with
   `mise run dev:infra:stop`.

If Docker is unavailable, the Tunnel token is missing, the origin build fails,
or a required port is occupied, the dependency task exits non-zero and mise
does not start the Turbo graph.

## Configuration Changes

- Root `mise.toml` adds the infrastructure tasks and task dependencies.
- Root `Makefile` adds one PostgreSQL-only target and a native-development VPC
  target with the gRPC host-port override.
- `apps/admin/rsbuild.config.ts` sets server port `3002` with strict port
  behavior.
- `apps/dapp/vite.config.ts` explicitly reserves inspector port `9229`.
- `services/api-gateway/vite.config.ts` reserves inspector port `9230` while
  retaining HTTP port `8787`.
- Root documentation explains the hybrid topology, persistent infrastructure,
  stop command, and the distinction from the full Docker stack.

## Testing

### Contract tests

The root Node test suite will assert:

- `dev`, `dev:api`, `dev:gateway`, and `dev:backend` depend on the correct mise
  infrastructure task.
- The Makefile exposes the exact infrastructure targets and the native VPC
  target applies host gRPC port `50052`.
- Admin uses HTTP port `3002` with strict-port behavior.
- Dapp and gateway use inspector ports `9229` and `9230` respectively.

The test must fail against the current configuration before production files
are changed.

### Static gates

Run `mise run typecheck`, `mise run check:ci`, `mise run lint`, and
`mise run build`. Run `mise run test` and report any independently reproduced
pre-existing failure separately.

### Runtime smoke test

Run `mise run dev` and wait for the following listeners or health endpoints:

- dapp `http://127.0.0.1:3000/`
- admin `http://127.0.0.1:3002/`
- landing `http://127.0.0.1:4321/`
- gateway `http://127.0.0.1:8787/healthz`
- native trading-rpc `http://127.0.0.1:3001/healthz`
- VPC origin `http://127.0.0.1:3003/healthz`
- Worker inspectors on `9229` and `9230`

Terminate the native command with Ctrl-C, verify no native listener remains,
then run `mise run dev:infra:stop` and verify the three Compose services are
stopped. No deployment command is run.

## Documentation

README, CONTRIBUTING, AGENTS, and Docker documentation will use `mise run`
commands. They will distinguish:

- `dev`: hybrid native coding loop with managed VPC infrastructure.
- `docker:start`: all application runtimes inside Docker.
- `dev:infra:stop`: cleanup for infrastructure left running after native dev.
