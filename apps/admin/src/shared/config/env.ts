import { z } from 'zod';

// Rsbuild only exposes variables prefixed with `PUBLIC_` to the browser bundle.
// The shape is validated at startup (a malformed URL fails loudly). The
// localhost fallback for API_URL applies ONLY in dev builds — a production
// build with no PUBLIC_API_URL set fails validation immediately instead of
// silently shipping a bundle that points at localhost.
const ZEnv = z.object({
  API_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
});

export const env = ZEnv.parse({
  API_URL:
    import.meta.env.PUBLIC_API_URL ??
    (import.meta.env.DEV ? 'http://localhost:46003' : undefined),
  // Treat an empty string as "not set" so `PUBLIC_SENTRY_DSN=` disables Sentry.
  SENTRY_DSN: import.meta.env.PUBLIC_SENTRY_DSN || undefined,
});

/** Public api-gateway URL used by every browser RPC client. */
export const API_URL = env.API_URL;
