# Runtime Service Name Design

## Goal

Remove backend service identity literals from production code. Both
`services/api-gateway` and `services/trading-rpc` receive their service name
from a required `SERVICE_NAME` runtime environment value, validate it at the
existing configuration boundary, and inject it into consumers.

## Decisions

- `SERVICE_NAME` is required in both services.
- Empty and whitespace-only values are invalid.
- Production code has no default service name and does not derive one from a
  package name, Worker name, hostname, or deployment environment.
- Deployment identity and logical service identity remain separate. For
  example, Wrangler Worker names may differ between staging and production,
  while both can intentionally use `SERVICE_NAME=api-gateway`.
- Existing runtime labels such as `node` and `cloudflare-workers` remain code
  constants because they describe the selected adapter/runtime, not the
  deployable service identity.

## API Gateway

### Configuration

Add `SERVICE_NAME` to `TGatewayRuntimeBindingValues` and
`ZGatewayRuntimeBindings`. `parseGatewayRuntimeConfig` returns a normalized
`serviceName` string. Missing, empty, or whitespace-only values fail validation
at the Worker request configuration boundary.

Configuration sources:

- `.dev.vars.sample`: `SERVICE_NAME=api-gateway`
- `wrangler.jsonc` staging vars: `SERVICE_NAME=api-gateway`
- `wrangler.jsonc` production vars: `SERVICE_NAME=api-gateway`

Wrangler's top-level and environment-specific `name` fields remain deployment
resource names and are not used as application identity.

### Dependency injection

- Replace the singleton `localApiCoreAdapter` with
  `createLocalApiCoreAdapter(serviceName)` so health responses receive the
  validated name.
- Replace the singleton `consoleGatewayLogger` with
  `createConsoleGatewayLogger(serviceName)` so structured logs receive the
  same validated identity.
- The request-scope composition in `src/index.ts` creates these adapters from
  `config.serviceName`; feature and domain code remain environment-agnostic.
- Generic Hono error handling resolves the request's configured logger rather
  than importing or embedding a service identity.

If configuration validation itself fails before a configured logger can be
created, the adapter emits a safe configuration-error response and a generic
console error without inventing a service name. This exceptional path does not
mask the invalid configuration.

## Trading RPC

### Configuration

Add required `SERVICE_NAME` validation to `ZRuntimeEnvironment` and expose it
as `TRuntimeConfig.serviceName`. Missing, empty, or whitespace-only values make
startup fail through the existing invalid-runtime-configuration error.

Configuration source:

- `.env.sample`: `SERVICE_NAME=trading-rpc`

Docker and deployment runtimes must supply the value through their normal
environment configuration. No image-level default is introduced.

### Dependency injection

- Add required `serviceName` to `TServerOptions`.
- The composition root passes `config.serviceName` into `createServer`.
- Connect `createRoutes` uses `options.serviceName` for health responses.
- Startup structured log context and Sentry initialization use the same
  identity where supported.
- The RPC smoke script parses runtime configuration instead of embedding its
  own service name.

Native gRPC method contracts are unchanged; service identity affects health,
telemetry, and operational identification only.

## Error behavior

Configuration errors fail closed:

- Trading RPC does not start.
- API Gateway returns its existing safe internal-error response for a request
  whose bindings are invalid.
- No fallback name is substituted.
- Validation details stay in trusted logs and are not exposed to clients.

## Testing

Follow test-driven development:

1. Add parser tests that require, trim, and expose `SERVICE_NAME` for each
   service. Run them and confirm they fail before implementation.
2. Add gateway tests proving the configured name reaches health responses and
   structured logs.
3. Add Trading RPC adapter tests proving `TServerOptions.serviceName` reaches
   Connect health responses.
4. Update existing fixtures to supply explicit service names.
5. Run architecture checks, typecheck, lint, all tests, and production builds.

## Non-goals

- Renaming packages, Worker resources, Docker images, Protobuf services, or
  Nest modules.
- Making `SERVICE_NAME` client-controlled or request-controlled.
- Adding a service discovery system or centralized configuration package.
- Changing HTTP, ConnectRPC, or native gRPC response/error casing.
