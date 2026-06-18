'use client';

// EXAMPLE: Client Component with TanStack Query + local state
// Use this pattern when: need client interactivity, data fetching with loading/error states
// Key: 'use client' at top, useQuery for async data, useState for local UI only

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getMockAPI } from '@/features/mock';

export default function ClientStatePage() {
  const [delay, setDelay] = useState(500);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['mock-example', delay],
    queryFn: () => getMockAPI({ delay }),
    staleTime: 5_000,
  });

  return (
    <div className="p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Client State Example</h1>
        <p className="text-muted-foreground mt-1">
          TanStack Query for server data, useState for local UI controls.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Simulated delay:</span>
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono">
          {delay}ms
        </span>
        <button
          type="button"
          onClick={() => setDelay((d) => Math.max(0, d - 500))}
          className="inline-flex items-center justify-center rounded-md border text-sm font-medium h-9 px-3 hover:bg-accent transition-colors"
        >
          −500ms
        </button>
        <button
          type="button"
          onClick={() => setDelay((d) => d + 500)}
          className="inline-flex items-center justify-center rounded-md border text-sm font-medium h-9 px-3 hover:bg-accent transition-colors"
        >
          +500ms
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-3 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isFetching ? 'Loading…' : 'Refetch'}
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive p-6">
          <p className="text-destructive text-sm">Failed to load data.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6 space-y-2">
          <h2 className="font-semibold">Result</h2>
          <p className="text-sm text-muted-foreground">{data?.data}</p>
        </div>
      )}
    </div>
  );
}
