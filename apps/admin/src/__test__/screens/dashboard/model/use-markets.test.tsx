import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TMarketsSnapshot } from '@/screens/dashboard/model/market.schema';
import { useMarkets } from '@/screens/dashboard/model/use-markets';

const { getMarketsMock } = vi.hoisted(() => ({ getMarketsMock: vi.fn() }));

vi.mock('@/screens/dashboard/api/markets.api', () => ({
  getMarkets: getMarketsMock,
}));

const snapshot: TMarketsSnapshot = {
  markets: [
    {
      id: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
    },
  ],
  vsCurrency: 'usd',
};

function MarketsProbe() {
  const { data } = useMarkets();
  return <span>{data?.markets[0]?.name ?? 'Loading'}</span>;
}

describe('useMarkets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reuse one in-flight request across a StrictMode remount', async () => {
    let resolveRequest: ((value: TMarketsSnapshot) => void) | undefined;
    getMarketsMock.mockImplementation(
      () =>
        new Promise<TMarketsSnapshot>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <MarketsProbe />
        </QueryClientProvider>
      </StrictMode>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(getMarketsMock).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest?.(snapshot);
    });
    expect(await screen.findByText('Bitcoin')).toBeTruthy();
  });
});
