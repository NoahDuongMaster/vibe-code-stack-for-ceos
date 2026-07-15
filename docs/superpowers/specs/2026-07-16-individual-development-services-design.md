# Individual Development Service Commands

## Goal

Keep `make start-development` as the command for the complete development stack
and add one discoverable command for each application service:

- `make start-dapp-development`
- `make start-admin-development`
- `make start-landing-development`
- `make start-api-gateway-development`
- `make start-trading-rpc-development`

Infrastructure containers are not exposed as new standalone commands. Docker
Compose starts the dependencies required by the selected application service.

## Architecture

The root `Makefile` remains the only command surface. Every individual target
uses the canonical base and development Compose files, the existing development
profiles, and `docker compose up -d --build <service>`.

The targets are explicit for discoverability while sharing the existing Compose
command variables. Targets whose dependency chain reaches `api-gateway` retain
the existing Cloudflare Tunnel-token check and Wrangler-token synchronization.
Other targets do not perform unrelated credential work.

## Behavior

- Starting a service rebuilds and starts that service in detached mode.
- Compose starts only that service and its declared dependencies, not every
  application in the repository.
- Missing Cloudflare credentials fail before starting services that need the VPC
  path, using the existing safe error behavior.
- The existing full-stack, VPC-stack, staging, and production targets remain
  unchanged.

## Testing

Add a shell contract test that executes the Make targets with fake `docker` and
`pnpm` executables. It verifies the selected Compose service, the development
overlays/profiles, build and detached flags, and credential preparation only for
the relevant targets. Include the test in `make check-docker` and document the
new commands in `infra/docker/README.md`.
