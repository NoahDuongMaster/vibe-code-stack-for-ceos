import 'server-only';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { env } from '@/shared/config/env.configuration';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/shared/constants/session.constant';
import type { TServerSessionData } from '@/shared/schemas/session.schema';

// The value committed in apps/dapp/.env.sample — valid enough to pass Zod's
// min(32) check, but public. Refuse to sign cookies with it in production
// instead of silently shipping sessions anyone can forge.
const SAMPLE_SESSION_SECRET = 'dev-session-secret-min-32-chars!!';

if (
  process.env.NODE_ENV === 'production' &&
  env.server.SESSION_SECRET === SAMPLE_SESSION_SECRET
) {
  throw new Error(
    'SESSION_SECRET is still set to the committed .env.sample placeholder. ' +
      'Generate a real secret (e.g. `openssl rand -base64 48`) and set it via ' +
      'your deploy environment or `wrangler secret put SESSION_SECRET` before ' +
      'running in production.',
  );
}

const SESSION_OPTIONS = {
  password: env.server.SESSION_SECRET,
  cookieName: SESSION_COOKIE_NAME,
  // Without this, iron-session's seal stays valid for its 14-day default
  // regardless of the cookie's own 7-day maxAge below.
  ttl: SESSION_MAX_AGE_SECONDS,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
};

export const getSession = async () => {
  const cookieStore = await cookies();
  return getIronSession<TServerSessionData>(cookieStore, SESSION_OPTIONS);
};

export const getSessionUser = async () => {
  const session = await getSession();
  return session.isLoggedIn ? session.user : null;
};
