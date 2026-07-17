import { useShallow } from 'zustand/react/shallow';
import { useSessionStore } from '@/entities/session/model/session.store';

/** Read-only view of the auth session + sign-out action. */
export const useSession = () =>
  useSessionStore(
    useShallow((s) => ({
      user: s.user,
      isAuthenticated: s.isAuthenticated,
      signOut: s.signOut,
    })),
  );
