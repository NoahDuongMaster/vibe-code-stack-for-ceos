'use client';
// Step 5 of full-feature pattern: Client Component
// Rules: 'use client', uses hooks, NO direct adapter imports

import { css } from '@/styled-system/css';
import { grid } from '@/styled-system/patterns';
import { usePosts } from '../hooks/use-posts';
import type { TPost } from '../schema/post.schema';

function PostCard({ post }: { post: TPost }) {
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
      <h3
        className={css({
          fontWeight: 'semibold',
          fontSize: 'base',
          lineHeight: 'none',
          letterSpacing: 'tight',
        })}
      >
        {post.title}
      </h3>
      <p
        className={css({
          fontSize: 'sm',
          color: 'muted.foreground',
          lineClamp: 3,
        })}
      >
        {post.body}
      </p>
    </div>
  );
}

export function PostList() {
  const { data, isLoading, isError } = usePosts({ limit: 10 });

  if (isLoading) {
    return (
      <div className={grid({ gap: '4', columns: { base: 1, md: 2 } })}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
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
                w: '3/4',
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
            <div
              className={css({
                h: '4',
                w: '2/3',
                animation: 'pulse 2s ease-in-out infinite',
                rounded: 'md',
                bg: 'muted',
              })}
            />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className={css({ color: 'destructive', fontSize: 'sm' })}>
        Failed to load posts.
      </p>
    );
  }

  return (
    <div className={grid({ gap: '4', columns: { base: 1, md: 2 } })}>
      {data?.data.items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
