'use client';

import type { TSessionData } from '@/entities/session';
import { useSession } from '@/entities/session/index.client';
import { useLogout } from '@/screens/account/model/use-logout';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

/**
 * Account-owned session UI. `initialSession` seeds the entity query so the
 * parent Server Component's session read is not repeated on mount.
 */
export function AccountSession({
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
