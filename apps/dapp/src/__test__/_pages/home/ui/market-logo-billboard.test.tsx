import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MarketLogoBillboard } from '@/_pages/home/ui/market-logo-billboard';

const billboardMocks = vi.hoisted(() => ({
  htmlProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@react-three/drei', () => ({
  Html: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    billboardMocks.htmlProps = props;
    return <div>{children}</div>;
  },
}));

vi.mock('@/_pages/home/ui/market-logo', () => ({
  MarketLogo: ({ imageUrl, symbol }: { imageUrl?: string; symbol: string }) => (
    <span data-image-url={imageUrl}>{symbol}</span>
  ),
}));

describe('[MarketLogoBillboard]', () => {
  it('should anchor a pointer-transparent real logo in front of the sphere', () => {
    const { getByText } = render(
      <MarketLogoBillboard
        imageUrl="https://coin-images.coingecko.com/ethereum.png"
        name="Ethereum"
        radius={0.8}
        symbol="ETH"
      />,
    );

    expect(getByText('ETH').getAttribute('data-image-url')).toBe(
      'https://coin-images.coingecko.com/ethereum.png',
    );
    expect(billboardMocks.htmlProps).toMatchObject({
      center: true,
      pointerEvents: 'none',
      sprite: true,
      transform: true,
    });
    const position = billboardMocks.htmlProps?.position as
      | [number, number, number]
      | undefined;
    expect(position?.slice(0, 2)).toEqual([0, 0]);
    expect(position?.[2]).toBeCloseTo(0.832);
  });
});
