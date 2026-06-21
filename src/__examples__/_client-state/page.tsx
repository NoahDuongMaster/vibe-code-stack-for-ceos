'use client';

// EXAMPLE: Client Component with TanStack Query + local state
// Use this pattern when: need client interactivity, data fetching with loading/error states
// Key: 'use client' at top, useQuery for async data, useState for local UI only

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getMockAPI } from '@/features/mock';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

export default function ClientStatePage() {
  const [delay, setDelay] = useState(500);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['mock-example', delay],
    queryFn: () => getMockAPI({ delay }),
    staleTime: 5_000,
  });

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
          Client State Example
        </h1>
        <p className={css({ color: 'muted.foreground', mt: '1' })}>
          TanStack Query for server data, useState for local UI controls.
        </p>
      </div>

      <div className={flex({ align: 'center', gap: '3', wrap: 'wrap' })}>
        <span className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
          Simulated delay:
        </span>
        <span
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            rounded: 'full',
            borderWidth: '1px',
            px: '2.5',
            py: '0.5',
            fontSize: 'xs',
            fontFamily: 'mono',
          })}
        >
          {delay}ms
        </span>
        <button
          type="button"
          onClick={() => setDelay((d) => Math.max(0, d - 500))}
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            rounded: 'md',
            borderWidth: '1px',
            fontSize: 'sm',
            fontWeight: 'medium',
            h: '9',
            px: '3',
            cursor: 'pointer',
            transition: 'colors',
            _hover: { bg: 'accent' },
          })}
        >
          −500ms
        </button>
        <button
          type="button"
          onClick={() => setDelay((d) => d + 500)}
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            rounded: 'md',
            borderWidth: '1px',
            fontSize: 'sm',
            fontWeight: 'medium',
            h: '9',
            px: '3',
            cursor: 'pointer',
            transition: 'colors',
            _hover: { bg: 'accent' },
          })}
        >
          +500ms
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            rounded: 'md',
            bg: 'primary',
            color: 'primary.foreground',
            fontSize: 'sm',
            fontWeight: 'medium',
            h: '9',
            px: '3',
            cursor: 'pointer',
            transition: 'colors',
            _hover: { opacity: 0.9 },
            _disabled: { opacity: 0.5 },
          })}
        >
          {isFetching ? 'Loading…' : 'Refetch'}
        </button>
      </div>

      {isLoading ? (
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
              w: '32',
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
      ) : isError ? (
        <div
          className={css({
            rounded: 'lg',
            borderWidth: '1px',
            borderColor: 'destructive',
            p: '6',
          })}
        >
          <p className={css({ color: 'destructive', fontSize: 'sm' })}>
            Failed to load data.
          </p>
        </div>
      ) : (
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
          <h2 className={css({ fontWeight: 'semibold' })}>Result</h2>
          <p className={css({ fontSize: 'sm', color: 'muted.foreground' })}>
            {data?.data}
          </p>
        </div>
      )}
    </div>
  );
}
