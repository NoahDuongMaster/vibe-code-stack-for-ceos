import { describe, expect, it } from 'vitest';
import type { TMarket } from '@/screens/home/model/market.schema';
import {
  MARKET_NEGATIVE_COLOR,
  MARKET_NEUTRAL_COLOR,
  MARKET_POSITIVE_COLOR,
  mapMarketsToBubbles,
} from '@/screens/home/model/market-scene.mapper';

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
