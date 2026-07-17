import type { TAuthSession } from '@/entities/session';
import { AuthError } from '@/pages/login/model/auth.error';
import type { TLoginInput } from '@/pages/login/model/login.schema';
import { ENABLE_MOCK_AUTH } from '@/shared/config';

/**
 * ── Mock auth (integration seam) ─────────────────────────────────────────────
 * The proto (@packages/protocol) has no AuthService yet, so this simulates a
 * login — any valid email + a 6+ char password "authenticates" — but ONLY
 * when PUBLIC_ENABLE_MOCK_AUTH=true (see shared/config/env.ts). Any deploy
 * that doesn't set it refuses every attempt instead of accepting anyone.
 *
 * To wire up real auth:
 *   1. Add an AuthService (Login RPC) to packages/protocol/proto/api/api.proto.
 *   2. Regenerate, then call it here via @packages/api-client instead of simulating.
 *   3. Delete this mock and PUBLIC_ENABLE_MOCK_AUTH entirely.
 * The store / hooks / components above stay untouched either way.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const login = async (input: TLoginInput): Promise<TAuthSession> => {
  if (!ENABLE_MOCK_AUTH) {
    throw new AuthError(
      'mock_auth_disabled',
      'Sign-in is not configured. Set PUBLIC_ENABLE_MOCK_AUTH=true for local development, or wire up a real AuthService RPC.',
    );
  }

  await delay(400);
  return {
    token: `demo.${btoa(input.email)}.token`,
    user: {
      id: 'me',
      email: input.email,
      name: input.email.split('@')[0] ?? input.email,
    },
  };
};
