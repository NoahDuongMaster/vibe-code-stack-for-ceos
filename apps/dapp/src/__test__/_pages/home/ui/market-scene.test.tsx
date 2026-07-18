import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketSceneNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketScene } from '@/_pages/home/ui/market-scene';

const r3fMocks = vi.hoisted(() => ({
  canvasProps: undefined as Record<string, unknown> | undefined,
  frameCallbacks: [] as Array<(state: unknown, delta: number) => void>,
  renderFallback: false,
}));
const activityState = vi.hoisted(() => ({
  reducedMotion: false,
  shouldAnimate: true,
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
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    r3fMocks.frameCallbacks.push(callback);
  },
}));
vi.mock('@react-three/drei', () => ({
  Grid: () => null,
  Sparkles: () => null,
}));
vi.mock('@/_pages/home/ui/use-market-scene-activity', () => ({
  useMarketSceneActivity: () => ({
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
    currentPrice: 70_000,
    priceChangePercentage24h: 2.5,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    currentPrice: 3_500,
    priceChangePercentage24h: -1.25,
  },
];

const nodes: TMarketSceneNode[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    position: [-0.625, 0, -1.45],
    height: 3.2,
    width: 0.82,
    depth: 0.72,
    lean: 0.11,
    pulseStrength: 0.9,
    revealDelay: 0,
    color: '#C7FF2F',
    emissiveIntensity: 1,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    position: [0.625, 0, 1.45],
    height: 2.4,
    width: 0.72,
    depth: 0.64,
    lean: -0.1,
    pulseStrength: 0.6,
    revealDelay: 0.06,
    color: '#FF3B5C',
    emissiveIntensity: 0.8,
  },
];

describe('[MarketScene]', () => {
  beforeEach(() => {
    r3fMocks.canvasProps = undefined;
    r3fMocks.frameCallbacks = [];
    r3fMocks.renderFallback = false;
    activityState.reducedMotion = false;
    activityState.shouldAnimate = true;
  });

  it('should configure a capped animated canvas and semantic selected asset', () => {
    render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(r3fMocks.canvasProps?.dpr).toEqual([1, 1.5]);
    expect(r3fMocks.canvasProps?.['aria-hidden']).toBe('true');
    expect(r3fMocks.canvasProps?.frameloop).toBe('always');
    expect(r3fMocks.canvasProps?.fallback).toBeTruthy();
    expect(r3fMocks.canvasProps?.gl).toMatchObject({
      alpha: true,
      powerPreference: 'high-performance',
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Active market / USD',
    );
    expect(screen.getByRole('status').textContent).toContain('BTC');
    expect(screen.getByRole('status').textContent).toContain('$70,000.00');
    expect(screen.getByRole('status').textContent).toContain('+2.50%');
  });

  it('should use a demand frame loop without mutation for reduced motion', () => {
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
    for (const frameCallback of r3fMocks.frameCallbacks) {
      expect(() =>
        frameCallback(
          { clock: { elapsedTime: 10 }, pointer: { x: 0, y: 0 } },
          0.016,
        ),
      ).not.toThrow();
    }
  });

  it('should select a liquidity blade from a pointer interaction', () => {
    const onActiveMarketChange = vi.fn();
    const { container } = render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={onActiveMarketChange}
      />,
    );

    const ethereumMesh = container.querySelector('mesh[name="ethereum"]');
    expect(ethereumMesh).toBeTruthy();
    expect(container.querySelector('icosahedronGeometry')).toBeNull();
    expect(container.querySelectorAll('boxGeometry').length).toBeGreaterThan(0);
    fireEvent.click(ethereumMesh as Element);
    expect(onActiveMarketChange).toHaveBeenCalledWith('ethereum');
  });

  it('should render the static fallback when WebGL is unavailable', () => {
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
    expect(screen.getAllByTestId('reactor-fallback-blade')).toHaveLength(10);
  });
});
