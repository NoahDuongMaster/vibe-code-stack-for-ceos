import { LoginForm } from '@/features/auth';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

export function LoginPage() {
  return (
    <main
      className={flex({
        align: 'center',
        justify: 'center',
        minH: '100vh',
        p: '6',
      })}
    >
      <div
        className={css({
          w: 'full',
          maxW: 'sm',
          p: '8',
          rounded: 'xl',
          borderWidth: '1px',
          borderColor: 'border',
          bg: 'card',
        })}
      >
        <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
          @repo/admin
        </h1>
        <p
          className={css({
            mt: '1',
            mb: '6',
            fontSize: 'sm',
            color: 'muted.foreground',
          })}
        >
          Sign in to the admin console.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
