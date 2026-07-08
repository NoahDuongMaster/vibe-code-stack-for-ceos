import 'server-only';
import { env } from '@/shared/config/env.configuration';
import type { TServerSessionUser } from '@/shared/schemas/session.schema';

// Known-public placeholder values — valid enough to pass Zod's min(1) check,
// but public, so refuse to authenticate anyone with any of them in
// production instead of silently shipping a well-known demo password.
// - 'change-me-please': the value committed in apps/dapp/.env.sample.
// - 'build-time-placeholder': baked into docker/production and
//   docker/staging Dockerfiles' builder stage; must never reach a running
//   container without being overridden at deploy time.
const KNOWN_PLACEHOLDER_DEMO_AUTH_PASSWORDS = new Set([
  'change-me-please',
  'build-time-placeholder',
]);

if (
  process.env.NODE_ENV === 'production' &&
  KNOWN_PLACEHOLDER_DEMO_AUTH_PASSWORDS.has(env.server.DEMO_AUTH_PASSWORD)
) {
  throw new Error(
    'DEMO_AUTH_PASSWORD is still set to a known placeholder value. ' +
      'Set a real value via your deploy environment or `wrangler secret put ' +
      'DEMO_AUTH_PASSWORD` before running in production.',
  );
}

/**
 * Verifies credentials against the env-configured demo account.
 *
 * This boilerplate ships without a real identity provider. To wire up real
 * auth: replace the body of this function with a call to your OAuth
 * token exchange / user database / IdP — the login route and session
 * contract (`TServerSessionUser`) stay the same either way.
 */
export const verifyCredentials = async (
  email: string,
  password: string,
): Promise<TServerSessionUser | null> => {
  const { DEMO_AUTH_EMAIL, DEMO_AUTH_PASSWORD } = env.server;

  const emailMatches = constantTimeEqual(
    email.trim().toLowerCase(),
    DEMO_AUTH_EMAIL.trim().toLowerCase(),
  );
  const passwordMatches = constantTimeEqual(password, DEMO_AUTH_PASSWORD);

  if (!emailMatches || !passwordMatches) return null;

  return { id: 'demo-user', email: DEMO_AUTH_EMAIL, name: 'Demo User' };
};

// Manual (not node:crypto) so this runs identically on the Node dev server
// and the Cloudflare Workers deploy target without depending on nodejs_compat.
const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};
