// Public API surface of @packages/api-core. Consumers (service runtimes, tests)
// import ONLY from here — the internal features/ · shared/ · runtime/ layout is
// free to change without breaking them.

export { DomainError, toConnectError } from './adapters/connect/errors';
// Runtime adapters — mount the domain on a specific runtime.
export { createFetchHandler } from './adapters/connect/fetch-handler';
export { createRoutes } from './adapters/connect/routes';
// Feature domain surfaces — for services/tests that need a service or schema.
export type { THealthResult } from './features/health';
export { healthService } from './features/health';
// Shared cross-cutting utilities, reused by the service runtimes.
export type { ApiConfig } from './shared/config';
export {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  isOriginAllowed,
  resolveCorsHeaders,
} from './shared/cors';
