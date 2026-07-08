import { Suspense } from 'react';
import { LoginForm } from '@/features/auth';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

/**
 * Reference route that consumes the `auth` vertical slice through its public
 * barrel (`@/features/auth`) — app/ never reaches into feature internals.
 * `proxy.ts` redirects unauthenticated visits to protected routes here.
 */
export default function SignInPage() {
  return (
    <main
      className={flex({
        minH: '100vh',
        alignItems: 'center',
        justify: 'center',
        px: '6',
        py: '12',
      })}
    >
      <div
        className={flex({
          direction: 'column',
          gap: '6',
          w: 'full',
          maxW: 'sm',
        })}
      >
        <h1
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            textAlign: 'center',
          })}
        >
          Sign in
        </h1>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
