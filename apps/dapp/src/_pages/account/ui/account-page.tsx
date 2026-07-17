import { AccountSession } from '@/_pages/account/ui/account-session';
import { getPublicSession } from '@/entities/session/index.server';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

/**
 * Session is read server-side (iron-session is already available here) and
 * passed down as `initialData` so the client doesn't refetch on first paint.
 */
export async function AccountPage() {
  const initialSession = await getPublicSession();

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
      <AccountSession initialSession={initialSession} />
    </main>
  );
}
