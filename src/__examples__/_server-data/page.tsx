// EXAMPLE: Server Component with async data fetching + Suspense streaming
// Use this pattern when: page needs data, no client-side interactivity required
// Key: no 'use client', direct async/await, Suspense for streaming

import { Suspense } from 'react';
import { getMockAPI } from '@/features/mock';
import { css } from '@/styled-system/css';

async function DataContent() {
  const result = await getMockAPI({ delay: 1000 });

  return (
    <div
      className={css({
        rounded: 'lg',
        borderWidth: '1px',
        bg: 'card',
        p: '6',
        display: 'flex',
        flexDir: 'column',
        gap: '2',
      })}
    >
      <h2 className={css({ fontWeight: 'semibold' })}>Server-side Data</h2>
      <p className={css({ fontSize: 'sm', color: 'muted.foreground' })}>
        {result.data}
      </p>
    </div>
  );
}

export default function ServerDataPage() {
  return (
    <div
      className={css({
        p: '8',
        maxW: '2xl',
        mx: 'auto',
        display: 'flex',
        flexDir: 'column',
        gap: '6',
      })}
    >
      <div>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
          Server Component Example
        </h1>
        <p className={css({ color: 'muted.foreground', mt: '1' })}>
          Data is fetched on the server. No loading state managed by client.
        </p>
      </div>

      <Suspense
        fallback={
          <div
            className={css({
              rounded: 'lg',
              borderWidth: '1px',
              bg: 'card',
              p: '6',
              display: 'flex',
              flexDir: 'column',
              gap: '3',
            })}
          >
            <div
              className={css({
                h: '5',
                w: '40',
                animation: 'pulse 2s ease-in-out infinite',
                rounded: 'md',
                bg: 'muted',
              })}
            />
            <div
              className={css({
                h: '4',
                w: 'full',
                animation: 'pulse 2s ease-in-out infinite',
                rounded: 'md',
                bg: 'muted',
              })}
            />
          </div>
        }
      >
        <DataContent />
      </Suspense>
    </div>
  );
}
