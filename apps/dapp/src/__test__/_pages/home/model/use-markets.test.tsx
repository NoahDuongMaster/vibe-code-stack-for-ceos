import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMarkets } from '@/_pages/home/api/get-markets.api';
import {
  MARKET_QUERY_KEY,
  MARKET_REFRESH_INTERVAL_MS,
} from '@/_pages/home/model/market.constants';
import type { TMarketsSnapshot } from '@/_pages/home/model/market.schema';
import {
  marketQueryOptions,
  useMarkets,
} from '@/_pages/home/model/use-markets';

vi.mock('@/_pages/home/api/get-markets.api', () => ({ getMarkets: vi.fn() }));

const SNAPSHOT: TMarketsSnapshot = {
  markets: [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }],
  vsCurrency: 'usd',
};

const createWrapper = (queryClient: QueryClient) =>
  function TestQueryProvider({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

describe('[UseMarkets]', () => {
  beforeEach(() => vi.resetAllMocks());

  it('should configure a cancellable 60-second market query', async () => {
    const queryClient = new QueryClient();
    vi.mocked(getMarkets).mockResolvedValue(SNAPSHOT);

    const { result } = renderHook(() => useMarkets(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMarkets).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(marketQueryOptions.queryKey).toEqual(MARKET_QUERY_KEY);
    expect(marketQueryOptions.staleTime).toBe(MARKET_REFRESH_INTERVAL_MS);
    expect(marketQueryOptions.refetchInterval).toBe(MARKET_REFRESH_INTERVAL_MS);
    expect(marketQueryOptions.retry).toBe(2);
  });
});
