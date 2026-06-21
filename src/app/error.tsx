'use client';

import { useRouter } from 'next/navigation';
import { WEB_ROUTES } from '@/shared/constants/routes.constant';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <section className={css({ bg: 'background' })}>
      <div
        className={flex({
          minH: '100vh',
          px: '6',
          py: '12',
          mx: 'auto',
          alignItems: 'center',
          justify: 'center',
        })}
      >
        <div className={css({ w: 'full', maxW: 'lg', textAlign: 'center' })}>
          <p
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'destructive',
            })}
          >
            Something went wrong
          </p>
          <h1
            className={css({
              mt: '3',
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'semibold',
              color: 'foreground',
            })}
          >
            Unexpected Error
          </h1>
          <p className={css({ mt: '4', color: 'muted.foreground' })}>
            An error occurred while rendering this page.
            {error.digest && (
              <span
                className={css({ display: 'block', mt: '1', fontSize: 'xs' })}
              >
                Error ID: {error.digest}
              </span>
            )}
          </p>

          <div
            className={flex({
              alignItems: 'center',
              justify: 'center',
              mt: '6',
              gap: '3',
            })}
          >
            <button
              type="button"
              onClick={reset}
              className={flex({
                alignItems: 'center',
                justify: 'center',
                px: '5',
                py: '2',
                fontSize: 'sm',
                color: 'foreground',
                bg: 'background',
                borderWidth: '1px',
                rounded: 'lg',
                gap: '2',
                cursor: 'pointer',
                transition: 'colors',
                _hover: { bg: 'accent' },
              })}
            >
              Try again
            </button>

            <button
              type="button"
              onClick={() => router.push(WEB_ROUTES.HOME)}
              className={css({
                px: '5',
                py: '2',
                fontSize: 'sm',
                letterSpacing: 'wide',
                color: 'primary.foreground',
                bg: 'primary',
                rounded: 'lg',
                cursor: 'pointer',
                transition: 'colors',
                _hover: { opacity: 0.9 },
              })}
            >
              Take me home
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ErrorPage;
