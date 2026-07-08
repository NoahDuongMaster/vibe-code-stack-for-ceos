'use client';

import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import { useLogout, useSession } from '../_hooks/use-session';
import type { TSessionData } from '../schemas/auth.schema';

/**
 * Reference client component for the auth slice: reads the session via the
 * feature hooks and signs the user out through the server action.
 * `initialSession` (from `getServerSession()`) seeds the query so the parent
 * Server Component's session read doesn't get refetched on mount.
 */
export function AuthStatus({
  initialSession,
}: {
  initialSession?: TSessionData;
} = {}) {
  const { data: session, isLoading } = useSession(initialSession);
  const logout = useLogout();

  if (isLoading) {
    return (
      <p className={css({ color: 'muted.foreground', fontSize: 'sm' })}>
        Checking session…
      </p>
    );
  }

  if (!session?.isLoggedIn) {
    return (
      <p className={css({ color: 'muted.foreground', fontSize: 'sm' })}>
        You are not signed in.
      </p>
    );
  }

  return (
    <div className={flex({ direction: 'column', gap: '3', align: 'start' })}>
      <p className={css({ fontSize: 'sm' })}>
        Signed in as{' '}
        <strong>{session.user?.name ?? session.user?.email}</strong>
      </p>
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className={css({
          px: '4',
          py: '2',
          rounded: 'lg',
          bg: 'primary',
          color: 'primary.foreground',
          fontSize: 'sm',
          fontWeight: 'semibold',
          cursor: 'pointer',
          _disabled: { opacity: 0.6, cursor: 'not-allowed' },
        })}
      >
        {logout.isPending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
