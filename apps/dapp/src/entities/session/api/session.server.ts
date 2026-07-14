import 'server-only';

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { env } from '@/shared/config';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../model/session.constants';
import { toPublicSession } from '../model/session.mapper';
import type { TServerSessionData, TSessionData } from '../model/session.schema';

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
  ttl: SESSION_MAX_AGE_SECONDS,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
};

export const getMutableSession = async () => {
  const cookieStore = await cookies();
  return getIronSession<TServerSessionData>(cookieStore, SESSION_OPTIONS);
};

const getSessionUser = async () => {
  const session = await getMutableSession();
  return session.isLoggedIn ? session.user : null;
};

export const getPublicSession = async (): Promise<TSessionData> => {
  const user = await getSessionUser();
  return toPublicSession(user);
};
