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
  compactViewport: false,
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
  Edges: () => <span data-testid="reactor-blade-edges" />,
  Grid: () => null,
  RoundedBox: ({
    children,
    name,
    onClick,
    onPointerOut,
    onPointerOver,
  }: {
    children?: React.ReactNode;
    name?: string;
    onClick?: (event: React.MouseEvent) => void;
    onPointerOut?: () => void;
    onPointerOver?: (event: React.MouseEvent) => void;
  }) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: the mock preserves React Three Fiber pointer handlers for the selection test.
    <mesh
      data-testid="reactor-beveled-blade"
      name={name}
      onClick={onClick}
      onPointerOut={onPointerOut}
      onPointerOver={onPointerOver}
    >
      {children}
    </mesh>
  ),
  Sparkles: () => null,
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
    activityState.compactViewport = false;
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
    expect(r3fMocks.canvasProps?.camera).toEqual({
      fov: 38,
      position: [4.6, 5.2, 7.1],
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Active market / USD',
    );
    expect(screen.getByRole('status').textContent).toContain('BTC');
    expect(screen.getByRole('status').textContent).toContain('$70,000.00');
    expect(screen.getByRole('status').textContent).toContain('+2.50%');
  });

  it('should pull the camera back to frame every blade on mobile', () => {
    activityState.compactViewport = true;
    render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(r3fMocks.canvasProps?.camera).toEqual({
      fov: 44,
      position: [6.4, 6.8, 11.6],
    });
  });

  it('should build each market from a beveled metallic body, bright cap, and crisp edges', () => {
    const { container } = render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('reactor-beveled-blade')).toHaveLength(
      nodes.length,
    );
    expect(screen.getAllByTestId('reactor-blade-edges')).toHaveLength(
      nodes.length,
    );
    expect(
      container.querySelectorAll('mesh[name^="market-cap-"]'),
    ).toHaveLength(nodes.length);
  });

  it('should place one active vertical beam in the selected liquidity lane', () => {
    const { container } = render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    const activeBeam = container.querySelector(
      'mesh[name="active-market-beam"]',
    );
    const activeBeamSheath = container.querySelector(
      'mesh[name="active-market-beam-sheath"]',
    );
    expect(activeBeam).toBeTruthy();
    expect(activeBeamSheath).toBeTruthy();
    expect(activeBeam?.getAttribute('data-market-id')).toBe('bitcoin');
    expect(activeBeamSheath?.getAttribute('data-market-id')).toBe('bitcoin');
    expect(
      activeBeam
        ?.closest('[data-lane-position]')
        ?.getAttribute('data-lane-position'),
    ).toBe('-0.625,-1.45');
  });

  it('should separate the market rows onto two liquidity lane bases', () => {
    const { container } = render(
      <MarketScene
        activeMarketId="bitcoin"
        markets={markets}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(
      container.querySelectorAll('mesh[name^="liquidity-lane-"]'),
    ).toHaveLength(2);
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
    expect(
      screen.getByTestId('canvas').querySelector('mesh[name="liquidity-scan"]'),
    ).toBeNull();
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
    expect(container.querySelector('mesh[name="liquidity-scan"]')).toBeTruthy();
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
