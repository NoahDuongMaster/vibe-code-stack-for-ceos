import type {
  TServerSessionUser,
  TSessionData,
} from '@/entities/session/model/session.schema';

/** Project the encrypted server session into the exact browser-safe shape. */
export const toPublicSession = (
  user: TServerSessionUser | null | undefined,
): TSessionData => {
  if (!user) return { isLoggedIn: false };

  const { id, email, name, avatarUrl } = user;
  return {
    isLoggedIn: true,
    user: { id, email, name, avatarUrl },
  };
};
