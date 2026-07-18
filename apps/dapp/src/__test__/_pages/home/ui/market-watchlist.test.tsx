import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { MarketWatchlist } from '@/_pages/home/ui/market-watchlist';

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    currentPrice: 70_000,
    priceChangePercentage24h: 2.5,
    marketCapRank: 1,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    currentPrice: 3_500,
    priceChangePercentage24h: -1.25,
    marketCapRank: 2,
  },
];

describe('[MarketWatchlist]', () => {
  it('should expose every asset as a native selection control', () => {
    const onActiveMarketChange = vi.fn();
    render(
      <MarketWatchlist
        activeMarketId="bitcoin"
        markets={markets}
        onActiveMarketChange={onActiveMarketChange}
      />,
    );

    expect(screen.getByRole('region', { name: 'Market watch' })).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Select Bitcoin' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.focus(screen.getByRole('button', { name: 'Select Ethereum' }));
    expect(onActiveMarketChange).toHaveBeenCalledWith('ethereum');
  });
});
