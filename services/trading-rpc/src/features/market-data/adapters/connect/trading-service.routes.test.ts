import { create } from '@bufbuild/protobuf';
import { Code } from '@connectrpc/connect';
import { GetMarketsRequestSchema } from '@packages/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createGetMarketsHandler } from '@/features/market-data/adapters/connect/trading-service.routes';
import type { GetMarkets } from '@/features/market-data/application/get-markets.port';
import { CoinId } from '@/features/market-data/domain/coin-id';
import { MarketDataUnavailableError } from '@/features/market-data/domain/errors';
import { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';
import { QuoteCurrency } from '@/features/market-data/domain/quote-currency';

describe('createGetMarketsHandler', () => {
  it('should validate the RPC request then map domain snapshots to the wire response', async () => {
    const getMarkets: GetMarkets = {
      execute: vi.fn(async () => ({
        markets: [
          new MarketSnapshot({
            coinId: CoinId.create('bitcoin'),
            symbol: 'btc',
            name: 'Bitcoin',
            currentPrice: 70_000,
          }),
        ],
        quoteCurrency: QuoteCurrency.create('usd'),
      })),
    };
    const handler = createGetMarketsHandler(getMarkets);

    await expect(
      handler(
        create(GetMarketsRequestSchema, {
          coinIds: [' BitCoin '],
          vsCurrency: ' USD ',
        }),
      ),
    ).resolves.toMatchObject({
      markets: [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          currentPrice: 70_000,
        },
      ],
      vsCurrency: 'usd',
    });
    expect(getMarkets.execute).toHaveBeenCalledWith({
      coinIds: ['bitcoin'],
      quoteCurrency: 'usd',
    });
  });

  it('should map invalid input and an unavailable provider to public Connect errors', async () => {
    const unavailableGetMarkets: GetMarkets = {
      execute: vi.fn(async () => {
        throw new MarketDataUnavailableError();
      }),
    };
    const handler = createGetMarketsHandler(unavailableGetMarkets);

    await expect(
      handler(
        create(GetMarketsRequestSchema, { coinIds: [], vsCurrency: 'usd' }),
      ),
    ).rejects.toMatchObject({
      code: Code.InvalidArgument,
      rawMessage: 'Invalid market request',
    });
    await expect(
      handler(
        create(GetMarketsRequestSchema, {
          coinIds: ['bitcoin'],
          vsCurrency: 'usd',
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.Unavailable,
      rawMessage: 'Crypto market data is unavailable',
    });
  });
});
