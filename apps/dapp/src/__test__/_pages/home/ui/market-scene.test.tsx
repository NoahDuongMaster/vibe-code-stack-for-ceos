import { render, screen } from '@testing-library/react';
import { type ComponentProps, createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketBubbleNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketScene } from '@/_pages/home/ui/market-scene';

const r3fMocks = vi.hoisted(() => ({
  canvasProps: undefined as Record<string, unknown> | undefined,
  renderFallback: false,
}));

const activityState = vi.hoisted(() => ({
  compactViewport: false,
  reducedMotion: false,
  shouldAnimate: true,
}));

const worldMocks = vi.hoisted(() => ({
  props: undefined as Record<string, unknown> | undefined,
}));

vi.mock('next/image', () => ({
  default: ({ alt, height, onError, src, width }: ComponentProps<'img'>) =>
    createElement('img', { alt, height, onError, src, width }),
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    r3fMocks.canvasProps = props;
    return r3fMocks.renderFallback ? (
      props.fallback
    ) : (
      <div data-testid="canvas">{props.children}</div>
    );
  },
}));

vi.mock('@/_pages/home/ui/market-gravity-world', () => ({
  MarketGravityWorld: (props: Record<string, unknown>) => {
    worldMocks.props = props;
    return <group name="market-gravity-world" />;
  },
}));

vi.mock('@/_pages/home/ui/use-market-scene-activity', () => ({
  useMarketSceneActivity: () => ({
    compactViewport: activityState.compactViewport,
    containerRef: { current: null },
    reducedMotion: activityState.reducedMotion,
    shouldAnimate: activityState.shouldAnimate,
  }),
}));

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    imageUrl: 'https://coin-images.coingecko.com/bitcoin.png',
    currentPrice: 70_000,
    priceChangePercentage24h: 2.5,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: 'https://coin-images.coingecko.com/ethereum.png',
    currentPrice: 3_500,
    priceChangePercentage24h: -1.25,
  },
];

const nodes: TMarketBubbleNode[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    imageUrl: 'https://coin-images.coingecko.com/bitcoin.png',
    radius: 1,
    mass: 1,
    seedPosition: [-2, 0, 0],
    seedVelocity: [0, 0, 0],
    activity: 0.8,
    haloColor: '#C7FF2F',
    haloIntensity: 0.7,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: 'https://coin-images.coingecko.com/ethereum.png',
    radius: 0.8,
    mass: 0.8 ** 3,
    seedPosition: [2, 0, 0],
    seedVelocity: [0, 0, 0],
    activity: 0.6,
    haloColor: '#FF3B5C',
    haloIntensity: 0.5,
  },
];

describe('[MarketScene]', () => {
  beforeEach(() => {
    r3fMocks.canvasProps = undefined;
    r3fMocks.renderFallback = false;
    worldMocks.props = undefined;
    activityState.reducedMotion = false;
    activityState.shouldAnimate = true;
    activityState.compactViewport = false;
  });

  it('should configure a capped gravity chamber and semantic selected asset', () => {
    render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Market gravity chamber' }),
    ).toBeTruthy();
    expect(r3fMocks.canvasProps?.dpr).toEqual([1, 1.5]);
    expect(r3fMocks.canvasProps?.['aria-hidden']).toBe('true');
    expect(r3fMocks.canvasProps?.frameloop).toBe('always');
    expect(r3fMocks.canvasProps?.camera).toEqual({
      fov: 42,
      position: [0, 0, 10.8],
    });
    expect(worldMocks.props).toMatchObject({
      activeMarketId: 'bitcoin',
      animate: true,
      compactViewport: false,
      nodes,
    });
    expect(screen.getByRole('status').textContent).toContain('BTC');
    expect(screen.getByRole('status').textContent).toContain('$70,000.00');
    expect(screen.getByRole('status').querySelector('img')).toBeTruthy();
    expect(
      screen
        .getByTestId('canvas')
        .querySelector('group[name="market-gravity-world"]'),
    ).toBeTruthy();
  });

  it('should use the compact camera without reintroducing canyon geometry', () => {
    activityState.compactViewport = true;
    const { container } = render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(r3fMocks.canvasProps?.camera).toEqual({
      fov: 48,
      position: [0, 0, 12.8],
    });
    expect(container.querySelector('boxGeometry')).toBeNull();
    expect(container.querySelector('[name^="liquidity-lane-"]')).toBeNull();
    expect(container.querySelector('[name="liquidity-scan"]')).toBeNull();
  });

  it('should use demand rendering and disable world motion for reduced motion', () => {
    activityState.reducedMotion = true;
    activityState.shouldAnimate = false;

    render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(r3fMocks.canvasProps?.frameloop).toBe('demand');
    expect(worldMocks.props?.animate).toBe(false);
  });

  it('should render real-logo bubbles in the static WebGL fallback', () => {
    r3fMocks.renderFallback = true;

    render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('market-scene-fallback')).toBeTruthy();
    expect(screen.getAllByTestId('gravity-fallback-bubble')).toHaveLength(2);
    expect(screen.queryByTestId('reactor-fallback-blade')).toBeNull();
    expect(
      screen.getByTestId('market-scene-fallback').querySelectorAll('img'),
    ).toHaveLength(2);
  });
});
