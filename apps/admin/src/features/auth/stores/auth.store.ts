import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setAuthToken } from '@/shared/lib/auth-token';
import type { Nullable } from '@/shared/types/common.types';
import type { TAuthSession, TAuthUser } from '../schemas/auth.schema';

type AuthState = {
  token: Nullable<string>;
  user: Nullable<TAuthUser>;
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
// live token fails with 401, and `shared/lib/api-client.ts`'s auth
// interceptor signs the user out and redirects to /login (see
// `shared/lib/auth-events.ts` + the listener registered in `src/index.tsx`)
// — a real backend would additionally validate the token server-side on
// every protected call.
export const useAuthStore = create<AuthState>()(
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
