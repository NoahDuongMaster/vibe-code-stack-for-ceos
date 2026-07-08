import { AuthStatus } from '@/features/auth';
import { getServerSession } from '@/features/auth/server';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

/**
 * Reference route that consumes the `auth` vertical slice through its public
 * barrel (`@/features/auth`) — app/ never reaches into feature internals.
 * Session is read server-side (iron-session is already available here) and
 * passed down as `initialData` so the client doesn't refetch on first paint.
 */
export default async function AccountPage() {
  const initialSession = await getServerSession();

  return (
    <main
      className={flex({
        direction: 'column',
        gap: '6',
        maxW: '2xl',
        mx: 'auto',
        px: '6',
        py: '24',
      })}
    >
      <h1 className={css({ fontSize: '3xl', fontWeight: 'bold' })}>Account</h1>
      <AuthStatus initialSession={initialSession} />
    </main>
  );
}
