import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MarketLogo } from '@/_pages/home/ui/market-logo';

vi.mock('next/image', () => ({
  default: ({ alt, height, onError, src, width }: ComponentProps<'img'>) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image.
    <img alt={alt} height={height} onError={onError} src={src} width={width} />
  ),
}));

describe('[MarketLogo]', () => {
  it('should render a decorative fixed-size market logo', () => {
    const { container } = render(
      <MarketLogo
        imageUrl="https://coin-images.coingecko.com/bitcoin.png"
        name="Bitcoin"
        size={32}
        symbol="BTC"
      />,
    );
    const image = container.querySelector('img');
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('width')).toBe('32');
    expect(image?.getAttribute('height')).toBe('32');
  });

  it('should isolate image failure to a symbol fallback', () => {
    const { container } = render(
      <MarketLogo
        imageUrl="https://coin-images.coingecko.com/bitcoin.png"
        name="Bitcoin"
        size={32}
        symbol="BTC"
      />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(screen.getByText('BT')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('should retry when the market image URL changes', () => {
    const { container, rerender } = render(
      <MarketLogo
        imageUrl="https://coin-images.coingecko.com/failed.png"
        name="Bitcoin"
        size={32}
        symbol="BTC"
      />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    rerender(
      <MarketLogo
        imageUrl="https://coin-images.coingecko.com/recovered.png"
        name="Bitcoin"
        size={32}
        symbol="BTC"
      />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://coin-images.coingecko.com/recovered.png',
    );
  });
});
