'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { css } from '@/styled-system/css';

const GlobalError = ({
  error,
  reset,
}: {
  error: Error & { message?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <section className={css({ bg: 'background' })}>
          <div
            className={css({
              py: '8',
              px: '4',
              mx: 'auto',
              maxW: '5xl',
              lg: { py: '16', px: '6' },
            })}
          >
            <div
              className={css({ mx: 'auto', maxW: 'xl', textAlign: 'center' })}
            >
              <h1
                className={css({
                  mb: '4',
                  fontSize: { base: '7xl', lg: '9xl' },
                  letterSpacing: 'tight',
                  fontWeight: 'extrabold',
                  color: 'destructive',
                })}
              >
                500
              </h1>
              <p
                className={css({
                  mb: '4',
                  fontSize: { base: '3xl', md: '4xl' },
                  letterSpacing: 'tight',
                  fontWeight: 'bold',
                  color: 'foreground',
                })}
              >
                Internal Server Error.
              </p>
              <p
                className={css({
                  mb: '4',
                  fontSize: 'lg',
                  fontWeight: 'light',
                  color: 'muted.foreground',
                })}
              >
                We are already working to solve the problem.
              </p>
              <button
                type="button"
                onClick={reset}
                className={css({
                  mt: '4',
                  px: '6',
                  py: '2',
                  rounded: 'md',
                  bg: 'primary',
                  color: 'primary.foreground',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: { opacity: 0.9 },
                })}
              >
                Try again
              </button>
            </div>
          </div>
        </section>
      </body>
    </html>
  );
};

export default GlobalError;
