'use client';
// Step 5 of full-feature pattern: Client Component
// Rules: 'use client', uses hooks, NO direct adapter imports

import { usePosts } from '../hooks/use-posts';
import type { TPost } from '../schema/post.schema';

function PostCard({ post }: { post: TPost }) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-2">
      <h3 className="font-semibold text-base leading-none tracking-tight">
        {post.title}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-3">{post.body}</p>
    </div>
  );
}

export function PostList() {
  const { data, isLoading, isError } = usePosts({ limit: 10 });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
            <div className="h-5 w-3/4 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-destructive text-sm">Failed to load posts.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data?.data.items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
