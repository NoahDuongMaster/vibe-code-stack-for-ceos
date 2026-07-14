import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setAuthToken } from '@/shared/api';
import type { TAuthSession, TAuthUser } from './session.schema';

type SessionState = {
  token: string | null;
  user: TAuthUser | null;
  isAuthenticated: boolean;
  signIn: (session: TAuthSession) => void;
  signOut: () => void;
};

// The token is deliberately kept OUT of persisted storage (see `partialize`
// below) — it lives in memory only, so an XSS payload reading
// sessionStorage/localStorage cannot exfiltrate it, and it does not survive a
// full page reload. Only `user`/`isAuthenticated` persist (to sessionStorage,
// not localStorage, so it clears when the tab closes) purely for a nicer
// "you were signed in as X" reload experience. Any API call made without a
// live token fails with 401, and `shared/api/api-client.ts`'s auth
// interceptor signs the user out and redirects to /login (see
// `shared/api/auth-events.ts` + the listener registered in the App layer)
// — a real backend would additionally validate the token server-side on
// every protected call.
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      signIn: ({ token, user }) => {
        setAuthToken(token);
        set({ token, user, isAuthenticated: true });
      },
      signOut: () => {
        setAuthToken(null);
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
