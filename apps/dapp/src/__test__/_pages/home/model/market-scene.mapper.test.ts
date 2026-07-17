import { describe, expect, it } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import {
  MARKET_NEGATIVE_COLOR,
  MARKET_POSITIVE_COLOR,
  mapMarketsToScene,
} from '@/_pages/home/model/market-scene.mapper';

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    marketCap: 1_400_000_000_000,
    priceChangePercentage24h: 12,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    marketCap: 500_000_000_000,
    priceChangePercentage24h: -8,
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
  },
];

describe('[MarketSceneMapper]', () => {
  it('should produce finite and bounded scene values', () => {
    const nodes = mapMarketsToScene(markets);

    expect(nodes).toHaveLength(markets.length);
    for (const node of nodes) {
      expect(
        Object.values(node).filter((value) => typeof value === 'number'),
      ).toSatisfy((values: number[]) => values.every(Number.isFinite));
      expect(node.scale).toBeGreaterThanOrEqual(0.72);
      expect(node.scale).toBeLessThanOrEqual(1.32);
      expect(node.emissiveIntensity).toBeGreaterThanOrEqual(0.35);
      expect(node.emissiveIntensity).toBeLessThanOrEqual(1.4);
      expect(node.orbitRadius).toBeGreaterThanOrEqual(2.4);
      expect(node.orbitRadius).toBeLessThanOrEqual(4.8);
    }
  });

  it('should encode positive and negative changes with different colors', () => {
    const nodes = mapMarketsToScene(markets);

    expect(nodes[0]?.color).toBe(MARKET_POSITIVE_COLOR);
    expect(nodes[1]?.color).toBe(MARKET_NEGATIVE_COLOR);
    expect(nodes[0]?.color).not.toBe(nodes[1]?.color);
  });
});
