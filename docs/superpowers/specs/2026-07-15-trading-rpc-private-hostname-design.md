# Trading RPC private hostname design

## Outcome

Give `trading-rpc` a stable, explicit private DNS name for traffic arriving
through Cloudflare Tunnel without coupling application code to Docker or
Cloudflare deployment details.

The canonical development hostname is `trading-rpc.internal`. It resolves only
on the private Compose network shared by `trading-rpc` and `cloudflared`.

## Current state

- Docker Compose already publishes the implicit service DNS name
  `trading-rpc` on every network joined by the service.
- The API Gateway uses `http://trading-rpc.internal` as the logical URL passed
  to the `TRADING_RPC` VPC Service binding. For a VPC Service, this URL supplies
  the HTTP `Host` header; the VPC Service configuration owns the physical host
  and port used for routing.
- `trading-rpc.internal` is not currently a Docker DNS alias, so it cannot be
  used as the physical VPC Service target through the local tunnel connector.

## Decision

Register `trading-rpc.internal` as a network-scoped alias of `trading-rpc` on
`trading-rpc-private`.

The alias is configurable through Compose interpolation:

```text
TRADING_RPC_PRIVATE_HOSTNAME=trading-rpc.internal
```

The default remains explicit in Compose, so development works without another
required environment file.

Do not set Docker's container-level `hostname`. Service discovery belongs to
the network, and a network alias remains stable when Compose replaces a
container or the service grows multiple replicas. Do not add the private
hostname to trading-rpc runtime configuration because application/domain code
does not need to know how the service is discovered.

## Network contract

```text
api-gateway Worker
  -> TRADING_RPC VPC Service binding
  -> Cloudflare Tunnel
  -> cloudflared
  -> http://trading-rpc.internal:3001
  -> trading-rpc Connect listener
```

- Private hostname: `trading-rpc.internal`
- Private HTTP port: `3001`
- Network scope: `trading-rpc-private` only
- Public host diagnostic port: `127.0.0.1:3003`
- Native gRPC diagnostic port: `127.0.0.1:50051`

The `trading-rpc-data` and `trading-rpc-egress` networks do not receive this
alias. PostgreSQL and unrelated application containers therefore cannot use
the VPC-facing hostname accidentally.

## Cloudflare configuration

The development VPC Service selected by the API Gateway's `TRADING_RPC`
binding must target:

- Type: HTTP
- Hostname: `trading-rpc.internal`
- HTTP port: `3001`
- Tunnel: the remotely managed development tunnel

The binding ID remains in `services/api-gateway/wrangler.jsonc`; physical host
selection stays in the Cloudflare VPC Service and is not duplicated in Worker
environment variables.

## Verification

1. Render the merged Compose configuration and assert that only
   `trading-rpc-private` contains the alias.
2. Recreate `trading-rpc` so Docker registers the alias.
3. Resolve `trading-rpc.internal` from `cloudflared`.
4. Request `http://trading-rpc.internal:3001/healthz` from a temporary container
   joined to `trading-rpc-private`, because the minimal cloudflared image does
   not guarantee a general HTTP client.
5. Smoke-test Gateway -> VPC -> trading-rpc after the Cloudflare VPC Service
   target is updated.
6. Run Compose validation, repository formatting, lint, tests, and build gates.

## Failure behavior

- An invalid or unresolved alias prevents the VPC Service from reaching the
  origin; the API Gateway retains its existing safe upstream-unavailable
  response.
- There is no direct URL fallback and no public exposure added by this change.
- The existing `trading-rpc` Compose service name remains resolvable for
  backward-compatible local diagnostics during the transition.

## Non-goals

- Public DNS or Cloudflare Access hostname creation.
- TLS between `cloudflared` and trading-rpc; the current private hop remains
  HTTP and can be upgraded separately.
- Changing the native gRPC listener or exposing it through the HTTP VPC Service.
