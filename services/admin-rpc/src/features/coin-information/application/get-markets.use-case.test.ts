import { describe, expect, it, vi } from 'vitest';
import { GetMarketsUseCase } from '@/features/coin-information/application/get-markets.use-case';

describe('GetMarketsUseCase', () => {
  it('should delegate coin lookup to the trading service port', async () => {
    const tradingMarketData = {
      getMarkets: vi.fn(async () => ({
        markets: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }],
        vsCurrency: 'usd',
      })),
    };
    const useCase = new GetMarketsUseCase(tradingMarketData);

    await expect(
      useCase.execute({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).resolves.toEqual({
      markets: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }],
      vsCurrency: 'usd',
    });
    expect(tradingMarketData.getMarkets).toHaveBeenCalledWith({
      coinIds: ['bitcoin'],
      vsCurrency: 'usd',
    });
  });
});
