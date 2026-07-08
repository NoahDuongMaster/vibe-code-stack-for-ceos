import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

// Auth (401) handling lives in `shared/lib/api-client.ts`'s interceptor +
// `auth-events.ts`, not here — it fires on any RPC call, not just ones made
// through React Query. These caches just make sure no query/mutation error
// is ever silently swallowed.
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.error(`[query:${String(query.queryKey[0])}]`, error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        logger.error(
          `[mutation:${mutation.options.mutationKey ?? 'unknown'}]`,
          error,
        );
      },
    }),
  });
}
