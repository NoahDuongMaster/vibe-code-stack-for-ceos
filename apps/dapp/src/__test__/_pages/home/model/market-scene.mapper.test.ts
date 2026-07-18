import { describe, expect, it } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import {
  MARKET_NEGATIVE_COLOR,
  MARKET_NEUTRAL_COLOR,
  MARKET_POSITIVE_COLOR,
  mapMarketsToBubbles,
  mapMarketsToScene,
} from '@/_pages/home/model/market-scene.mapper';

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    imageUrl: 'https://coin-images.coingecko.com/bitcoin.png',
    marketCap: 1_400_000_000_000,
    totalVolume: 52_000_000_000,
    priceChangePercentage24h: 12,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: 'https://coin-images.coingecko.com/ethereum.png',
    marketCap: 500_000_000_000,
    totalVolume: 19_000_000_000,
    priceChangePercentage24h: -8,
  },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
];

describe('[MarketSceneMapper]', () => {
  it('should produce finite and bounded liquidity blade values', () => {
    const nodes = mapMarketsToScene(markets);

    expect(nodes).toHaveLength(3);
    for (const node of nodes) {
      const numericValues = [
        ...node.position,
        node.height,
        node.width,
        node.depth,
        node.lean,
        node.pulseStrength,
        node.revealDelay,
        node.emissiveIntensity,
      ];
      expect(numericValues.every(Number.isFinite)).toBe(true);
      expect(node.height).toBeGreaterThanOrEqual(0.9);
      expect(node.height).toBeLessThanOrEqual(3.6);
      expect(node.width).toBeGreaterThanOrEqual(0.54);
      expect(node.width).toBeLessThanOrEqual(0.86);
      expect(Math.abs(node.lean)).toBeLessThanOrEqual(0.26);
      expect(node.pulseStrength).toBeGreaterThanOrEqual(0.18);
      expect(node.pulseStrength).toBeLessThanOrEqual(1);
    }
  });

  it('should encode direction, volume, and stable request-order lanes', () => {
    const nodes = mapMarketsToScene(markets);

    expect(nodes[0]?.color).toBe(MARKET_POSITIVE_COLOR);
    expect(nodes[1]?.color).toBe(MARKET_NEGATIVE_COLOR);
    expect(nodes[2]?.color).toBe(MARKET_NEUTRAL_COLOR);
    expect(nodes[0]?.pulseStrength).toBeGreaterThan(
      nodes[1]?.pulseStrength ?? 0,
    );
    expect(nodes.map(({ position }) => position)).toEqual([
      [-2.5, 0, -1.45],
      [-1.25, 0, -1.45],
      [0, 0, -1.45],
    ]);
  });

  it('should map missing optional data to deterministic neutral values', () => {
    const first = mapMarketsToScene([markets[2] as TMarket])[0];
    const second = mapMarketsToScene([markets[2] as TMarket])[0];

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      color: MARKET_NEUTRAL_COLOR,
      height: 1.386,
      pulseStrength: 0.3276,
    });
  });
});

describe('[MarketBubbleMapper]', () => {
  it('should map real market identity into finite bounded bubbles', () => {
    const nodes = mapMarketsToBubbles(markets);

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({
      id: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'BTC',
      imageUrl: 'https://coin-images.coingecko.com/bitcoin.png',
      haloColor: MARKET_POSITIVE_COLOR,
    });
    expect(nodes[1]?.haloColor).toBe(MARKET_NEGATIVE_COLOR);
    expect(nodes[2]?.haloColor).toBe(MARKET_NEUTRAL_COLOR);
    for (const node of nodes) {
      expect(node.radius).toBeGreaterThanOrEqual(0.48);
      expect(node.radius).toBeLessThanOrEqual(1.05);
      expect(node.mass).toBeCloseTo(node.radius ** 3, 8);
      expect(node.activity).toBeGreaterThanOrEqual(0.2);
      expect(node.activity).toBeLessThanOrEqual(1);
      expect(node.haloIntensity).toBeGreaterThanOrEqual(0.25);
      expect(node.haloIntensity).toBeLessThanOrEqual(1);
      expect(
        [...node.seedPosition, ...node.seedVelocity].every(Number.isFinite),
      ).toBe(true);
    }
    expect(nodes[0]?.radius).toBeGreaterThan(nodes[1]?.radius ?? 0);
  });

  it('should derive deterministic safe values without optional metrics', () => {
    const first = mapMarketsToBubbles([markets[2] as TMarket])[0];
    const second = mapMarketsToBubbles([markets[2] as TMarket])[0];

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      id: 'solana',
      radius: 0.5826,
      activity: 0.344,
      haloColor: MARKET_NEUTRAL_COLOR,
      haloIntensity: 0.25,
    });
  });
});
