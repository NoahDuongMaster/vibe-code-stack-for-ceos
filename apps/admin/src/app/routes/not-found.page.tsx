import { Link } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes.constant';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

export function NotFoundPage() {
  return (
    <div
      className={flex({
        direction: 'column',
        align: 'center',
        justify: 'center',
        gap: '4',
        py: '24',
        textAlign: 'center',
      })}
    >
      <h1 className={css({ fontSize: '5xl', fontWeight: 'bold' })}>404</h1>
      <p className={css({ color: 'muted.foreground' })}>
        This page could not be found.
      </p>
      <Link
        to={ROUTES.DASHBOARD}
        className={css({
          color: 'primary',
          fontWeight: 'semibold',
          textDecoration: 'underline',
        })}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
