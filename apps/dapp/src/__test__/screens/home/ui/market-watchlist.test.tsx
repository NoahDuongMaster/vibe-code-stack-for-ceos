/* biome-ignore-all lint/performance/noImgElement: this file mocks next/image with its minimal DOM equivalent. */
/* eslint-disable @next/next/no-img-element -- this file mocks next/image with its minimal DOM equivalent */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TMarket } from '@/screens/home/model/market.schema';
import { MarketWatchlist } from '@/screens/home/ui/market-watchlist';

vi.mock('next/image', () => ({
  default: ({ alt, height, onError, src, width }: ComponentProps<'img'>) => (
    <img alt={alt} height={height} onError={onError} src={src} width={width} />
  ),
}));

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    imageUrl: 'https://coin-images.coingecko.com/bitcoin.png',
    currentPrice: 70_000,
    priceChangePercentage24h: 2.5,
    marketCapRank: 1,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: 'https://coin-images.coingecko.com/ethereum.png',
    currentPrice: 3_500,
    priceChangePercentage24h: -1.25,
    marketCapRank: 2,
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    currentPrice: 150,
    marketCapRank: 3,
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
    expect(
      screen
        .getByRole('button', { name: 'Select Bitcoin' })
        .querySelector('img')
        ?.getAttribute('src'),
    ).toBe('https://coin-images.coingecko.com/bitcoin.png');
    fireEvent.focus(screen.getByRole('button', { name: 'Select Ethereum' }));
    expect(onActiveMarketChange).toHaveBeenCalledWith('ethereum');
  });

  it('should render a missing change with neutral Plasma semantics', () => {
    render(
      <MarketWatchlist
        activeMarketId="bitcoin"
        markets={markets}
        onActiveMarketChange={vi.fn()}
      />,
    );

    const neutralChange = screen
      .getByRole('button', { name: 'Select Solana' })
      .querySelector('[data-tone]');

    expect(neutralChange?.textContent).toBe('—');
    expect(neutralChange?.getAttribute('data-tone')).toBe('plasma');
  });
});
