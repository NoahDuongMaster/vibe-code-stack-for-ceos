import { z } from 'zod';

// Rsbuild only exposes variables prefixed with `PUBLIC_` to the browser bundle.
// The shape is validated at startup (a malformed URL fails loudly). The
// localhost fallback for API_URL applies ONLY in dev builds — a production
// build with no PUBLIC_API_URL set fails validation immediately instead of
// silently shipping a bundle that points at localhost.
const ZEnv = z.object({
  API_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
  // Fail-safe default: false. The proto (@repo/protocol) has no AuthService
  // yet, so features/auth simulates login — but only when this is explicitly
  // set to "true" (see features/auth/adapters/auth.adapter.ts). Any deploy
  // that doesn't set it refuses every login attempt instead of accepting any
  // 6+ char password as valid. Hard-gated to dev builds below regardless of
  // this value — a leaked PUBLIC_ENABLE_MOCK_AUTH=true in a prod env must not
  // enable it.
  ENABLE_MOCK_AUTH: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

export const env = ZEnv.parse({
  API_URL:
    import.meta.env.PUBLIC_API_URL ??
    (import.meta.env.DEV ? 'http://localhost:3001' : undefined),
  // Treat an empty string as "not set" so `PUBLIC_SENTRY_DSN=` disables Sentry.
  SENTRY_DSN: import.meta.env.PUBLIC_SENTRY_DSN || undefined,
  // import.meta.env.DEV is statically replaced at build time, so a production
  // build can never enable mock auth no matter what env var reaches it.
  ENABLE_MOCK_AUTH: import.meta.env.DEV
    ? import.meta.env.PUBLIC_ENABLE_MOCK_AUTH
    : undefined,
});

/** Base URL of the backend serving ApiService (api-node or api-gateway). */
export const API_URL = env.API_URL;

/** Whether the mock login in features/auth is allowed to authenticate anyone. */
export const ENABLE_MOCK_AUTH = env.ENABLE_MOCK_AUTH;
