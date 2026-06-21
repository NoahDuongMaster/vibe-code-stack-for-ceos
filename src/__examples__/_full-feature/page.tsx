// Step 6 of full-feature pattern: Server Component page (entry point)
// Rules: no 'use client', minimal logic — render Client Components via Suspense

import { Suspense } from 'react';
import { css } from '@/styled-system/css';
import { grid } from '@/styled-system/patterns';
import { PostList } from './components/post-list';

export default function FullFeaturePage() {
  return (
    <div
      className={css({
        p: '8',
        maxW: '4xl',
        mx: 'auto',
        display: 'flex',
        flexDir: 'column',
        gap: '6',
      })}
    >
      <div>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
          Full Feature Example
        </h1>
        <p className={css({ color: 'muted.foreground', mt: '1' })}>
          Complete pattern: schema → adapter → service → hook → component → page
        </p>
      </div>

      <Suspense
        fallback={
          <div className={grid({ gap: '4', columns: { base: 1, md: 2 } })}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={css({
                  h: '32',
                  w: 'full',
                  animation: 'pulse 2s ease-in-out infinite',
                  rounded: 'xl',
                  bg: 'muted',
                })}
              />
            ))}
          </div>
        }
      >
        <PostList />
      </Suspense>
    </div>
  );
}
