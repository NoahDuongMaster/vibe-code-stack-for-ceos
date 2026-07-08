import 'server-only';
import { getSessionUser } from '@/server/lib/session';
import type { TSessionData } from '../schemas/auth.schema';

/**
 * Server-only session read for Server Components — avoids an extra
 * client-side round trip to `/api/auth/me` on first paint. Client
 * components still go through `authService`/`useSession` for interactive
 * updates (login/logout).
 */
export const getServerSession = async (): Promise<TSessionData> => {
  const user = await getSessionUser();
  return { isLoggedIn: !!user, user: user ?? undefined };
};
