import type { AdminServiceGetMarketsResponse } from '@packages/api-client';
import { describe, expect, it } from 'vitest';
import {
  createMarketSummary,
  mapMarketsResponse,
} from '@/screens/dashboard/model/market.mapper';

const response = {
  markets: [
    {
      id: 'ethereum',
      symbol: 'eth',
      name: ' Ethereum ',
      marketCap: 400_000_000_000,
      priceChangePercentage24h: -1.5,
      totalVolume: 20_000_000_000,
    },
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      marketCap: 1_300_000_000_000,
      priceChangePercentage24h: 2.25,
      totalVolume: 40_000_000_000,
    },
  ],
  vsCurrency: 'usd',
} as unknown as AdminServiceGetMarketsResponse;

describe('market mapper', () => {
  it('should normalize ordering and calculate an operational summary', () => {
    const snapshot = mapMarketsResponse(response);

    expect(snapshot.markets.map(({ id }) => id)).toEqual([
      'bitcoin',
      'ethereum',
    ]);
    expect(snapshot.markets.map(({ symbol }) => symbol)).toEqual([
      'BTC',
      'ETH',
    ]);
    expect(snapshot.markets[1]?.name).toBe('Ethereum');
    expect(createMarketSummary(snapshot)).toEqual({
      totalMarketCap: 1_700_000_000_000,
      totalVolume24h: 60_000_000_000,
      gainerCount: 1,
      loserCount: 1,
    });
  });

  it('should reject duplicate market IDs at the browser trust boundary', () => {
    const duplicate = {
      ...response,
      markets: [response.markets[0], response.markets[0]],
    } as AdminServiceGetMarketsResponse;

    expect(() => mapMarketsResponse(duplicate)).toThrow(
      'Market IDs must be unique',
    );
  });
});
