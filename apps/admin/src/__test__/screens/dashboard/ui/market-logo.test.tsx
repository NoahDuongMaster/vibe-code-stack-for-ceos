import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketLogo } from '@/screens/dashboard/ui/market-logo';

describe('MarketLogo', () => {
  it('should render a decorative fixed-size coin image', () => {
    const { container } = render(
      <MarketLogo
        imageUrl="https://assets.example.com/bitcoin.png"
        name="Bitcoin"
        symbol="BTC"
      />,
    );
    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe(
      'https://assets.example.com/bitcoin.png',
    );
    expect(image?.getAttribute('alt')).toBe('');
    expect(image?.getAttribute('width')).toBe('36');
    expect(image?.getAttribute('height')).toBe('36');
  });

  it('should fall back to the symbol when the coin image fails', () => {
    const { container } = render(
      <MarketLogo
        imageUrl="https://assets.example.com/missing.png"
        name="Bitcoin"
        symbol="BTC"
      />,
    );

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(screen.getByText('BT')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });
});
