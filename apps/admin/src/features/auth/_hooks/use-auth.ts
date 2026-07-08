import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/auth.store';

/** Read-only view of the auth session + sign-out action. */
export const useAuth = () =>
  useAuthStore(
    useShallow((s) => ({
      user: s.user,
      isAuthenticated: s.isAuthenticated,
      signOut: s.signOut,
    })),
  );
