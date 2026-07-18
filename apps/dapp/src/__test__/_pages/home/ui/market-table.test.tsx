import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { MarketTable } from '@/_pages/home/ui/market-table';

vi.mock('next/image', () => ({
  default: ({ alt, height, onError, src, width }: ComponentProps<'img'>) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image.
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
    marketCap: 1_400_000_000_000,
    marketCapRank: 1,
    totalVolume: 52_000_000_000,
    priceChangePercentage24h: 2.5,
  },
];

describe('[MarketTable]', () => {
  it('should render real logos in desktop and mobile selection controls', () => {
    render(
      <MarketTable
        activeMarketId="bitcoin"
        markets={markets}
        onActiveMarketChange={vi.fn()}
      />,
    );

    const controls = screen.getAllByRole('button', {
      name: 'Highlight Bitcoin in 3D',
    });
    expect(controls).toHaveLength(2);
    for (const control of controls) {
      expect(control.getAttribute('aria-pressed')).toBe('true');
      expect(control.querySelector('img')?.getAttribute('src')).toBe(
        'https://coin-images.coingecko.com/bitcoin.png',
      );
    }
  });

  it('should preserve the table selection behavior', () => {
    const onActiveMarketChange = vi.fn();
    render(
      <MarketTable
        activeMarketId="bitcoin"
        markets={markets}
        onActiveMarketChange={onActiveMarketChange}
      />,
    );

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Highlight Bitcoin in 3D',
      })[0] as HTMLButtonElement,
    );
    expect(onActiveMarketChange).toHaveBeenCalledWith('bitcoin');
  });
});
