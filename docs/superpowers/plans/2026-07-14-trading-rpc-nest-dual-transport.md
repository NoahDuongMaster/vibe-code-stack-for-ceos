# Trading RPC Nest Dual-Transport Implementation Plan

**Goal:** Make NestJS the service host while preserving the Cloudflare-facing
Connect endpoint and adding a separate native Nest gRPC endpoint for Node
microservices. Both transports invoke the same application use cases.

**Architecture:** Nest runs on `FastifyAdapter` and owns modules, dependency
injection, HTTP health, lifecycle hooks, interceptors, and native gRPC
controllers. The official Connect Fastify plugin is mounted on Nest's underlying
Fastify instance for the Worker VPC `fetch()` path. `MarketDataModule` owns the
feature providers and exposes one `GetMarkets` input port to both adapters.

## Constraints

- Preserve the published Protobuf contracts and generated source.
- Preserve the gateway's existing Connect/HTTP request path.
- Native gRPC listens on a separate configurable port.
- Keep domain and application layers framework-free.
- Validate external RPC input with Zod in both transport adapters.
- Do not alter unrelated dirty worktree changes.

## Tasks

1. Lock the current 28 service tests, architecture tests, and typecheck.
2. Add failing tests for the gRPC port config and Nest-hosted runtime.
3. Add exact-pinned Nest 11, grpc-js, proto-loader, reflection, and RxJS
   dependencies.
4. Add a dynamic Nest root module, feature module/providers, HTTP health
   controller, native gRPC controllers, Zod pipe, safe gRPC exception filter,
   and a global timing/error interceptor.
5. Mount ConnectRPC, CORS, rate limiting, and body limits through Nest's
   underlying Fastify instance.
6. Bootstrap both listeners and use Nest lifecycle shutdown hooks.
7. Copy canonical Protobuf assets into the production bundle/image and expose
   the gRPC port.
8. Update the service example documentation and root architecture description.
9. Run targeted tests followed by repo-wide typecheck, checks, lint, tests, and
   build.
