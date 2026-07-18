import { create } from '@bufbuild/protobuf';
import {
  CryptoMarketSchema,
  GetMarketsResponseSchema,
} from '@packages/protocol';
import { describe, expect, it, vi } from 'vitest';
import { CoinInformationUnavailableError } from '@/features/coin-information/domain/errors';
import { createTradingRpcMarketData } from '@/features/coin-information/infra/grpc/trading-rpc-market-data.adapter';

describe('createTradingRpcMarketData', () => {
  const options = {
    baseUrl: 'http://trading-rpc.internal:50051',
    timeoutMs: 2_500,
  };

  it('should call trading-rpc with a deadline and validate its response', async () => {
    const getMarkets = vi.fn(async () =>
      create(GetMarketsResponseSchema, {
        markets: [
          create(CryptoMarketSchema, {
            id: 'bitcoin',
            symbol: 'btc',
            name: 'Bitcoin',
            currentPrice: 70_000,
          }),
        ],
        vsCurrency: 'usd',
      }),
    );
    const adapter = createTradingRpcMarketData(options, { getMarkets });

    await expect(
      adapter.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', currentPrice: 70_000 }],
      vsCurrency: 'usd',
    });
    expect(getMarkets).toHaveBeenCalledWith(
      { coinIds: ['bitcoin'], vsCurrency: 'usd' },
      { timeoutMs: 2_500 },
    );
  });

  it('should convert invalid responses and transport failures to a domain error', async () => {
    const invalidResponse = createTradingRpcMarketData(options, {
      getMarkets: vi.fn(async () =>
        create(GetMarketsResponseSchema, {
          markets: [
            create(CryptoMarketSchema, {
              id: '',
              symbol: 'btc',
              name: 'Bitcoin',
            }),
          ],
          vsCurrency: 'usd',
        }),
      ),
    });
    const transportFailure = createTradingRpcMarketData(options, {
      getMarkets: vi.fn(async () => {
        throw new Error('private upstream details');
      }),
    });

    await expect(
      invalidResponse.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).rejects.toBeInstanceOf(CoinInformationUnavailableError);
    await expect(
      transportFailure.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).rejects.toMatchObject({
      name: 'CoinInformationUnavailableError',
      message: 'Coin information is unavailable',
    });
  });

  it('should reject a response whose quote currency differs from the request', async () => {
    const adapter = createTradingRpcMarketData(options, {
      getMarkets: vi.fn(async () =>
        create(GetMarketsResponseSchema, {
          markets: [],
          vsCurrency: 'eur',
        }),
      ),
    });

    await expect(
      adapter.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).rejects.toBeInstanceOf(CoinInformationUnavailableError);
  });
});
