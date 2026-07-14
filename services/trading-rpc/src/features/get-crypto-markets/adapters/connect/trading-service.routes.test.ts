import { create } from '@bufbuild/protobuf';
import { Code } from '@connectrpc/connect';
import { GetMarketsRequestSchema } from '@packages/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { GetCryptoMarkets } from '../../application/get-crypto-markets.port';
import { CoinId } from '../../domain/coin-id';
import { MarketDataUnavailableError } from '../../domain/errors';
import { MarketSnapshot } from '../../domain/market-snapshot';
import { createGetCryptoMarketsHandler } from './trading-service.routes';

describe('createGetCryptoMarketsHandler', () => {
  it('should validate the RPC request then map domain snapshots to the wire response', async () => {
    const getCryptoMarkets: GetCryptoMarkets = {
      execute: vi.fn(async () => [
        new MarketSnapshot({
          coinId: CoinId.create('bitcoin'),
          symbol: 'btc',
          name: 'Bitcoin',
          currentPrice: 70_000,
        }),
      ]),
    };
    const handler = createGetCryptoMarketsHandler(getCryptoMarkets);

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
    expect(getCryptoMarkets.execute).toHaveBeenCalledWith({
      coinIds: [CoinId.create('bitcoin')],
      quoteCurrency: expect.objectContaining({ value: 'usd' }),
    });
  });

  it('should map invalid input and an unavailable provider to public Connect errors', async () => {
    const unavailableGetCryptoMarkets: GetCryptoMarkets = {
      execute: vi.fn(async () => {
        throw new MarketDataUnavailableError();
      }),
    };
    const handler = createGetCryptoMarketsHandler(unavailableGetCryptoMarkets);

    await expect(
      handler(
        create(GetMarketsRequestSchema, { coinIds: [], vsCurrency: 'usd' }),
      ),
    ).rejects.toMatchObject({ code: Code.InvalidArgument });
    await expect(
      handler(
        create(GetMarketsRequestSchema, {
          coinIds: ['bitcoin'],
          vsCurrency: 'usd',
        }),
      ),
    ).rejects.toMatchObject({ code: Code.Unavailable });
  });
});
