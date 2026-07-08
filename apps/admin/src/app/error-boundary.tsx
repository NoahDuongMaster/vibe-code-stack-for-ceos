import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { ROUTES } from '@/shared/constants/routes.constant';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

// Generic, user-safe copy — the real error (which may contain internal
// details) goes to Sentry, never to the rendered page.
const GENERIC_DETAIL = 'Please try again, or go back to the dashboard.';

export function RouteError() {
  const error = useRouteError();

  useEffect(() => {
    if (isRouteErrorResponse(error) && error.status < 500) return;
    Sentry.captureException(error);
  }, [error]);

  const { title, detail } = isRouteErrorResponse(error)
    ? { title: `${error.status}`, detail: error.statusText || GENERIC_DETAIL }
    : { title: 'Something went wrong', detail: GENERIC_DETAIL };

  return (
    <main
      className={flex({
        direction: 'column',
        align: 'center',
        justify: 'center',
        gap: '4',
        minH: '100vh',
        p: '6',
        textAlign: 'center',
      })}
    >
      <h1 className={css({ fontSize: '4xl', fontWeight: 'bold' })}>{title}</h1>
      <p className={css({ color: 'muted.foreground' })}>{detail}</p>
      <Link
        to={ROUTES.DASHBOARD}
        className={css({
          px: '4',
          py: '2',
          rounded: 'lg',
          bg: 'primary',
          color: 'primary.foreground',
          fontSize: 'sm',
          fontWeight: 'semibold',
        })}
      >
        Back to dashboard
      </Link>
    </main>
  );
}
