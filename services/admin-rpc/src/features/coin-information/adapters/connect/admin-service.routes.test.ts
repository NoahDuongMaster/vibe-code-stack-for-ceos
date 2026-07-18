import { create } from '@bufbuild/protobuf';
import { Code } from '@connectrpc/connect';
import { AdminServiceGetMarketsRequestSchema } from '@packages/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createGetMarketsHandler } from '@/features/coin-information/adapters/connect/admin-service.routes';
import type { GetMarkets } from '@/features/coin-information/application/get-markets.port';
import { CoinInformationUnavailableError } from '@/features/coin-information/domain/errors';

describe('createGetMarketsHandler', () => {
  it('should validate and normalize input before mapping the coin response', async () => {
    const getMarkets: GetMarkets = {
      execute: vi.fn(async () => ({
        markets: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }],
        vsCurrency: 'usd',
      })),
    };
    const handler = createGetMarketsHandler(getMarkets);

    await expect(
      handler(
        create(AdminServiceGetMarketsRequestSchema, {
          coinIds: [' BitCoin '],
          vsCurrency: ' USD ',
        }),
      ),
    ).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }],
      vsCurrency: 'usd',
    });
    expect(getMarkets.execute).toHaveBeenCalledWith({
      coinIds: ['bitcoin'],
      vsCurrency: 'usd',
    });
  });

  it('should expose only safe invalid-input and upstream-unavailable errors', async () => {
    const getMarkets: GetMarkets = {
      execute: vi.fn(async () => {
        throw new CoinInformationUnavailableError();
      }),
    };
    const handler = createGetMarketsHandler(getMarkets);

    await expect(
      handler(
        create(AdminServiceGetMarketsRequestSchema, {
          coinIds: [],
          vsCurrency: 'usd',
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.InvalidArgument,
      rawMessage: 'Invalid market request',
    });
    await expect(
      handler(
        create(AdminServiceGetMarketsRequestSchema, {
          coinIds: ['bitcoin'],
          vsCurrency: 'usd',
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.Unavailable,
      rawMessage: 'Coin information is unavailable',
    });
  });
});
