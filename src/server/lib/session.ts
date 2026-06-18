import 'server-only';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { TSessionData } from '@/shared/types/session.types';

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'app-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export const getSession = async () => {
  const cookieStore = await cookies();
  return getIronSession<TSessionData>(cookieStore, SESSION_OPTIONS);
};

export const getSessionUser = async () => {
  const session = await getSession();
  return session.isLoggedIn ? session.user : null;
};
