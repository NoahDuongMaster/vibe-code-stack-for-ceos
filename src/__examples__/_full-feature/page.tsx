// Step 6 of full-feature pattern: Server Component page (entry point)
// Rules: no 'use client', minimal logic — render Client Components via Suspense

import { Suspense } from 'react';
import { PostList } from './components/post-list';

export default function FullFeaturePage() {
  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Full Feature Example</h1>
        <p className="text-muted-foreground mt-1">
          Complete pattern: schema → adapter → service → hook → component → page
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 w-full animate-pulse rounded-xl bg-muted"
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
