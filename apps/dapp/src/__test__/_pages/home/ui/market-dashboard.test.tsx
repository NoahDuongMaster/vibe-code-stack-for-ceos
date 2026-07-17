import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TMarketsSnapshot } from '@/_pages/home/model/market.schema';
import { MarketDashboard } from '@/_pages/home/ui/market-dashboard';

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  refetch: vi.fn(),
  useMarkets: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: mocks.captureException,
}));
vi.mock('@/_pages/home/model/use-markets', () => ({
  useMarkets: mocks.useMarkets,
}));
vi.mock('@/_pages/home/ui/market-scene-loader', () => ({
  MarketSceneLoader: ({
    activeMarketId,
    markets,
  }: {
    activeMarketId?: string;
    markets: TMarketsSnapshot['markets'];
  }) => (
    <div data-testid="market-scene">
      Scene: {markets.length} / {activeMarketId ?? 'none'}
    </div>
  ),
}));

const MARKET_NAMES = [
  ['bitcoin', 'BTC', 'Bitcoin'],
  ['ethereum', 'ETH', 'Ethereum'],
  ['tether', 'USDT', 'Tether'],
  ['binancecoin', 'BNB', 'BNB'],
  ['solana', 'SOL', 'Solana'],
  ['ripple', 'XRP', 'XRP'],
  ['usd-coin', 'USDC', 'USDC'],
  ['dogecoin', 'DOGE', 'Dogecoin'],
  ['cardano', 'ADA', 'Cardano'],
  ['avalanche-2', 'AVAX', 'Avalanche'],
] as const;

const SNAPSHOT: TMarketsSnapshot = {
  markets: MARKET_NAMES.map(([id, symbol, name], index) => ({
    id,
    symbol,
    name,
    currentPrice: index === 0 ? 70_000 : 100 + index,
    marketCap: 1_000_000_000 * (10 - index),
    marketCapRank: index + 1,
    priceChangePercentage24h: index % 2 === 0 ? 2.5 + index : -1.25,
    totalVolume: 10_000_000 * (index + 1),
    lastUpdated: '2026-07-18T12:00:00.000Z',
  })),
  vsCurrency: 'usd',
};

const queryState = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  data: undefined,
  dataUpdatedAt: 0,
  error: null,
  errorUpdatedAt: 0,
  isError: false,
  isFetching: false,
  isPending: false,
  refetch: mocks.refetch,
  ...overrides,
});

describe('[MarketDashboard]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMarkets.mockReturnValue(queryState());
  });

  it('should render loading state with neutral scene data', () => {
    mocks.useMarkets.mockReturnValue(
      queryState({ isFetching: true, isPending: true }),
    );

    render(<MarketDashboard />);

    expect(
      screen.getByRole('status', { name: /loading market data/i }),
    ).toBeTruthy();
    expect(screen.getByTestId('market-scene').textContent).toContain(
      'Scene: 0 / none',
    );
  });

  it('should render selected USD metrics and all ten markets', () => {
    mocks.useMarkets.mockReturnValue(
      queryState({
        data: SNAPSHOT,
        dataUpdatedAt: Date.parse('2026-07-18T12:00:00.000Z'),
      }),
    );

    render(<MarketDashboard />);

    expect(screen.getByRole('heading', { name: 'Vibe Markets' })).toBeTruthy();
    expect(screen.getAllByText('$70,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Selected market cap')).toBeTruthy();
    expect(screen.getByText('Selected 24h volume')).toBeTruthy();
    for (const [, , name] of MARKET_NAMES) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it('should expose updating and stale cached-data states', () => {
    const { rerender } = render(<MarketDashboard />);

    mocks.useMarkets.mockReturnValue(
      queryState({ data: SNAPSHOT, isFetching: true }),
    );
    rerender(<MarketDashboard />);
    expect(screen.getByText('Updating')).toBeTruthy();

    const error = new Error('private detail');
    mocks.useMarkets.mockReturnValue(
      queryState({
        data: SNAPSHOT,
        error,
        errorUpdatedAt: 42,
        isError: true,
      }),
    );
    rerender(<MarketDashboard />);
    expect(screen.getByText('Data may be stale')).toBeTruthy();
    expect(screen.queryByText('private detail')).toBeNull();
    expect(mocks.captureException).toHaveBeenCalledWith(error);
  });

  it('should show a generic first-load error and retry the query', async () => {
    const user = userEvent.setup();
    mocks.useMarkets.mockReturnValue(
      queryState({
        error: new Error('private upstream detail'),
        errorUpdatedAt: 21,
        isError: true,
      }),
    );

    render(<MarketDashboard />);
    expect(
      screen.getByText('Market data is temporarily unavailable.'),
    ).toBeTruthy();
    expect(screen.queryByText('private upstream detail')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it('should render missing metrics as em dashes', () => {
    mocks.useMarkets.mockReturnValue(
      queryState({
        data: {
          markets: [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }],
          vsCurrency: 'usd',
        },
      }),
    );

    render(<MarketDashboard />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('should highlight a market in the scene from keyboard focus', () => {
    mocks.useMarkets.mockReturnValue(queryState({ data: SNAPSHOT }));
    render(<MarketDashboard />);

    fireEvent.focus(
      screen.getAllByRole('button', {
        name: 'Highlight Ethereum in 3D',
      })[0] as HTMLButtonElement,
    );

    expect(screen.getByTestId('market-scene').textContent).toContain(
      'Scene: 10 / ethereum',
    );
  });
});
