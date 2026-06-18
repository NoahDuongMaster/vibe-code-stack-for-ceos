// EXAMPLE: Server Component with async data fetching + Suspense streaming
// Use this pattern when: page needs data, no client-side interactivity required
// Key: no 'use client', direct async/await, Suspense for streaming

import { Suspense } from 'react';
import { getMockAPI } from '@/features/mock';

async function DataContent() {
  const result = await getMockAPI({ delay: 1000 });

  return (
    <div className="rounded-lg border bg-card p-6 space-y-2">
      <h2 className="font-semibold">Server-side Data</h2>
      <p className="text-sm text-muted-foreground">{result.data}</p>
    </div>
  );
}

export default function ServerDataPage() {
  return (
    <div className="p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Server Component Example</h1>
        <p className="text-muted-foreground mt-1">
          Data is fetched on the server. No loading state managed by client.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
          </div>
        }
      >
        <DataContent />
      </Suspense>
    </div>
  );
}
