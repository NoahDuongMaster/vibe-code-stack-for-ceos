# Health Protocol Rename Design

**Date:** 2026-07-18

**Status:** Approved for implementation

## Problem

`packages/protocol/proto/api/v1/api.proto` now publishes only the health RPC,
but its file, package, and service still use the generic names `api.proto`,
`api.v1`, and `ApiService`. Those names came from the initial scaffold, when the
service also contained an Echo RPC, and no longer describe the contract's
capability.

The generic names leak into generated symbols, imports, gRPC registration, and
the public Connect path `/api.v1.ApiService/Health`. That makes the protocol
harder to discover and leaves no useful boundary for future domain services.

## Goals

- Give the health capability a domain-specific Protobuf file, package, and
  service name.
- Keep the existing health request and response fields unchanged.
- Update every generated artifact and consumer to the new contract.
- Remove all production and test references to the obsolete API contract.
- Keep both Connect and native gRPC transports serving the same health use case.

## Non-goals

- Do not change health response semantics or add readiness/liveness variants.
- Do not change the existing `/healthz` HTTP endpoint.
- Do not adopt the standard `grpc.health.v1.Health` protocol in this change;
  the repository's response intentionally includes service and runtime
  metadata that the standard response does not expose.
- Do not add a compatibility alias for the old Connect or gRPC service name.
- Do not change the separate `trading.v1.TradingService` contract.

## Approaches Considered

### 1. Rename the full published contract — selected

Move the source to `proto/health/v1/health.proto`, declare package `health.v1`,
and rename the service to `HealthService`. This makes the source layout,
generated symbol, gRPC descriptor, and Connect path consistently describe the
capability.

This is intentionally a breaking contract change: consumers must move from
`/api.v1.ApiService/Health` to `/health.v1.HealthService/Health`.

### 2. Rename only the file — rejected

Using `proto/api/v1/health.proto` would improve source discovery while retaining
`api.v1.ApiService`. It would avoid a wire-path change, but the public package
and service would remain generic and preserve the original design problem.

### 3. Adopt the standard gRPC health protocol — rejected for this change

The standard protocol improves interoperability with generic gRPC probes, but
its response model does not carry this repository's `service` and `runtime`
metadata. Adopting it would require a separate service-info contract or a
semantic change beyond this naming refactor.

## Contract Design

The canonical source becomes:

```proto
syntax = "proto3";

package health.v1;

message HealthRequest {}

message HealthResponse {
  string status = 1;
  string service = 2;
  string runtime = 3;
}

service HealthService {
  rpc Health(HealthRequest) returns (HealthResponse) {}
}
```

Buf generates `src/gen/health/v1/health_pb.ts`, and the protocol package root
exports that module. The old `src/gen/api/v1/api_pb.ts` artifact is removed by
regeneration.

## Consumer Changes

- `packages/api-core` registers its existing health handler on `HealthService`.
- `packages/api-client` exposes the same client factory and public client type,
  backed by `HealthService` instead of `ApiService`.
- `services/trading-rpc` loads `health/v1/health.proto`, registers native gRPC
  method `HealthService.Health`, and serves the new Connect descriptor.
- `services/api-gateway` allowlists the new Connect health path.
- Tests, smoke scripts, comments, and environment documentation use the new
  service name and path.

The application flow and error behavior remain unchanged:

```text
client -> HealthService.Health -> existing health handler/use case
       -> HealthResponse { status, service, runtime }
```

## Compatibility

No old service alias is retained. This avoids publishing two names for one
capability and is acceptable because the repository controls all current
consumers. Any external consumer must regenerate its client and switch to
`health.v1.HealthService` as part of the same release.

## Testing

- Regenerate protocol code through the package's Buf generation command.
- Update protocol, API client, API core, trading RPC, and gateway tests so the
  new descriptor and `/health.v1.HealthService/Health` path are asserted.
- Search the repository for obsolete `ApiService`, `api.v1`, `api_pb`, and
  `api.proto` references; only unrelated natural-language uses of “API service”
  may remain.
- Run `mise run typecheck`, `mise run check:ci`, `mise run lint`, and
  `mise run test`.
- Run `mise run build` because generated protocol imports and service runtime
  configuration are build-relevant.

## Deployment

No local deployment is performed. The change proceeds through the repository's
normal CI-gated deployment flow.
