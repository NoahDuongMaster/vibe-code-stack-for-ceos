import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TMarketBubbleNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketBubble } from '@/_pages/home/ui/market-bubble';

vi.mock('@/_pages/home/ui/market-logo-texture', () => ({
  MarketLogoTexture: ({ symbol }: { symbol: string }) => (
    <mesh name={`market-logo-${symbol}`} />
  ),
}));

const node: TMarketBubbleNode = {
  id: 'ethereum',
  symbol: 'ETH',
  name: 'Ethereum',
  imageUrl: 'https://coin-images.coingecko.com/ethereum.png',
  radius: 0.8,
  mass: 0.8 ** 3,
  seedPosition: [1, 0, 0],
  seedVelocity: [0, 0, 0],
  activity: 0.7,
  haloColor: '#FF3B5C',
  haloIntensity: 0.8,
};

describe('[MarketBubble]', () => {
  it('should render a logo-bearing sphere without legacy canyon geometry', () => {
    const { container } = render(
      <MarketBubble
        active={false}
        node={node}
        objectRef={vi.fn()}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('sphereGeometry')).toHaveLength(2);
    expect(
      container.querySelector('mesh[name="market-halo-ethereum"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('mesh[name="market-logo-ETH"]'),
    ).toBeTruthy();
    expect(container.querySelector('boxGeometry')).toBeNull();
    expect(container.querySelector('[name^="liquidity-lane-"]')).toBeNull();
    expect(container.querySelector('[data-market-id]')).toBeNull();
    expect(container.querySelector('[data-lane-position]')).toBeNull();
  });

  it('should select the market from the sphere shell', () => {
    const onActiveMarketChange = vi.fn();
    const { container } = render(
      <MarketBubble
        active={false}
        node={node}
        objectRef={vi.fn()}
        onActiveMarketChange={onActiveMarketChange}
      />,
    );

    fireEvent.click(
      container.querySelector(
        'mesh[name="market-bubble-shell-ethereum"]',
      ) as Element,
    );
    expect(onActiveMarketChange).toHaveBeenCalledWith('ethereum');
  });
});
