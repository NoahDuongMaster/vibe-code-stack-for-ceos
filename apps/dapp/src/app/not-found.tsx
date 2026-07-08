'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WEB_ROUTES } from '@/shared/constants/routes.constant';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

const NotFound = () => {
  const router = useRouter();
  return (
    <main className={css({ bg: 'background' })}>
      <div
        className={flex({
          minH: '100vh',
          px: '6',
          py: '12',
          mx: 'auto',
          lg: { alignItems: 'center', gap: '12' },
        })}
      >
        <div className={css({ w: 'full', lg: { w: '1/2' } })}>
          <p
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'primary',
            })}
          >
            404 error
          </p>
          <h1
            className={css({
              mt: '3',
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'semibold',
              color: 'foreground',
            })}
          >
            Page not found
          </h1>
          <p className={css({ mt: '4', color: 'muted.foreground' })}>
            Sorry, the page you are looking for doesn&apos;t exist. Here are
            some helpful links:
          </p>

          <div className={flex({ alignItems: 'center', mt: '6', gap: '3' })}>
            <button
              type="button"
              onClick={() => router.back()}
              className={flex({
                alignItems: 'center',
                justify: 'center',
                w: { base: '1/2', sm: 'auto' },
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className={css({ w: '5', h: '5' })}
                aria-hidden="true"
              >
                <title>Go back</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18"
                />
              </svg>
              <span>Go back</span>
            </button>

            <Link
              href={WEB_ROUTES.HOME}
              className={css({
                w: { base: '1/2', sm: 'auto' },
                px: '5',
                py: '2',
                fontSize: 'sm',
                letterSpacing: 'wide',
                color: 'primary.foreground',
                bg: 'primary',
                rounded: 'lg',
                flexShrink: 0,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'colors',
                _hover: { opacity: 0.9 },
              })}
            >
              Take me home
            </Link>
          </div>
        </div>

        <div
          className={css({
            position: 'relative',
            w: 'full',
            mt: '12',
            lg: { w: '1/2', mt: '0' },
          })}
        >
          <Image
            className={css({ w: 'full', maxW: 'lg', mx: 'auto' })}
            src="/images/common/404.svg"
            alt="404"
            width={514}
            height={164}
          />
        </div>
      </div>
    </main>
  );
};

export default NotFound;
