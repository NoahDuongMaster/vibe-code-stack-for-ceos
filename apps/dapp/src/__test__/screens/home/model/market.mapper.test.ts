import type { CryptoMarket, GetMarketsResponse } from '@packages/api-client';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  createMarketSummary,
  mapMarketsResponse,
} from '@/screens/home/model/market.mapper';

type TMarketFixture = Omit<CryptoMarket, '$typeName'>;
type TResponseFixture = Omit<GetMarketsResponse, '$typeName' | 'markets'> & {
  markets: TMarketFixture[];
};

const BITCOIN_MARKET = {
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  imageUrl: 'https://assets.example.com/bitcoin.png',
  currentPrice: 70_000,
  marketCap: 1_400_000_000_000,
  marketCapRank: 1,
  priceChange24h: 1_750,
  priceChangePercentage24h: 2.5,
  totalVolume: 42_000_000_000,
  lastUpdated: '2026-07-18T00:00:00.000Z',
};

const response = (
  overrides: Partial<TResponseFixture> = {},
): GetMarketsResponse =>
  ({
    markets: [BITCOIN_MARKET],
    vsCurrency: 'usd',
    ...overrides,
  }) as unknown as GetMarketsResponse;

describe('[MarketMapper]', () => {
  it('should normalize and order a semantically valid response', () => {
    const snapshot = mapMarketsResponse(
      response({
        markets: [
          {
            ...BITCOIN_MARKET,
            id: 'ethereum',
            symbol: 'eth',
            name: 'Ethereum',
          },
          BITCOIN_MARKET,
        ],
      }),
    );

    expect(snapshot).toMatchObject({
      markets: [
        { id: 'bitcoin', symbol: 'BTC', currentPrice: 70_000 },
        { id: 'ethereum', symbol: 'ETH', currentPrice: 70_000 },
      ],
      vsCurrency: 'usd',
    });
  });

  it('should preserve missing optional market metrics', () => {
    const snapshot = mapMarketsResponse(
      response({
        markets: [
          {
            id: 'bitcoin',
            symbol: 'btc',
            name: 'Bitcoin',
          },
        ],
      }),
    );

    expect(snapshot.markets[0]).toMatchObject({
      currentPrice: undefined,
      marketCap: undefined,
      priceChangePercentage24h: undefined,
    });
  });

  it.each([
    ['empty markets', response({ markets: [] })],
    [
      'unknown market ID',
      response({ markets: [{ ...BITCOIN_MARKET, id: 'unknown-coin' }] }),
    ],
    [
      'non-finite values',
      response({ markets: [{ ...BITCOIN_MARKET, currentPrice: Number.NaN }] }),
    ],
    ['non-USD quote', response({ vsCurrency: 'eur' })],
  ])('should reject %s', (_case, marketResponse) => {
    expect(() => mapMarketsResponse(marketResponse)).toThrow(ZodError);
  });

  it('should summarize the selected market set', () => {
    const snapshot = mapMarketsResponse(
      response({
        markets: [
          BITCOIN_MARKET,
          {
            ...BITCOIN_MARKET,
            id: 'ethereum',
            symbol: 'eth',
            name: 'Ethereum',
            marketCap: 500_000_000_000,
            totalVolume: 20_000_000_000,
            priceChangePercentage24h: -1.25,
          },
          {
            ...BITCOIN_MARKET,
            id: 'solana',
            symbol: 'sol',
            name: 'Solana',
            marketCap: undefined,
            totalVolume: undefined,
            priceChangePercentage24h: 5,
          },
        ],
      }),
    );

    expect(createMarketSummary(snapshot)).toMatchObject({
      selectedMarketCap: 1_900_000_000_000,
      selectedVolume24h: 62_000_000_000,
      gainerCount: 2,
      loserCount: 1,
      strongestGainer: { id: 'solana' },
    });
  });
});
