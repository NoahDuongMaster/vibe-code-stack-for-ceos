import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketDashboard } from '@/pages/dashboard/ui/market-dashboard';

const useMarketsMock = vi.fn();

vi.mock('@/pages/dashboard/model/use-markets', () => ({
  useMarkets: () => useMarketsMock(),
}));

const snapshot = {
  markets: [
    {
      id: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      currentPrice: 68_000,
      marketCap: 1_300_000_000_000,
      marketCapRank: 1,
      priceChangePercentage24h: 2.25,
      totalVolume: 40_000_000_000,
      lastUpdated: '2026-07-18T09:30:00.000Z',
    },
    {
      id: 'ethereum',
      symbol: 'ETH',
      name: 'Ethereum',
      currentPrice: 3_500,
      marketCap: 400_000_000_000,
      marketCapRank: 2,
      priceChangePercentage24h: -1.5,
      totalVolume: 20_000_000_000,
      lastUpdated: '2026-07-18T09:30:00.000Z',
    },
  ],
  vsCurrency: 'usd',
} as const;

describe('MarketDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Ark UI overview and let the operator inspect live assets', async () => {
    useMarketsMock.mockReturnValue({
      data: snapshot,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();

    render(<MarketDashboard />);

    expect(
      screen.getByRole('heading', { name: 'Tracked market share' }),
    ).toBeTruthy();
    expect(screen.getByText('$1.7T')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Live assets' }));

    expect(
      screen.getByRole('table', {
        name: 'Live crypto market information from admin RPC',
      }),
    ).toBeTruthy();
    expect(screen.getByText('BTC · #1')).toBeTruthy();
    expect(screen.getByText('−1.50%')).toBeTruthy();
  });

  it('should show a generic retry state without leaking backend errors', async () => {
    const refetch = vi.fn();
    useMarketsMock.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch,
    });
    const user = userEvent.setup();

    render(<MarketDashboard />);
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'Market feed unavailable',
    );
    expect(refetch).toHaveBeenCalledOnce();
  });
});
