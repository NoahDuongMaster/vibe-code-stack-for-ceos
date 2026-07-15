import { describe, expect, it, vi } from 'vitest';
import { GetMarketsUseCase } from '@/features/market-data/application/get-markets.use-case';
import { CoinId } from '@/features/market-data/domain/coin-id';
import type { MarketDataProvider } from '@/features/market-data/domain/market-data-provider.port';
import { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';
import type { MarketSnapshotRepository } from '@/features/market-data/domain/market-snapshot.repository.port';
import { QuoteCurrency } from '@/features/market-data/domain/quote-currency';

describe('GetMarketsUseCase', () => {
  it('should retrieve snapshots through its injected market-data provider port', async () => {
    const bitcoin = CoinId.create('bitcoin');
    const request = {
      coinIds: [' BitCoin '],
      quoteCurrency: ' USD ',
    };
    const markets = [
      new MarketSnapshot({
        coinId: bitcoin,
        symbol: 'btc',
        name: 'Bitcoin',
        currentPrice: 70_000,
      }),
    ];
    const provider: MarketDataProvider = {
      getMarkets: vi.fn(async () => markets),
    };
    const repository: MarketSnapshotRepository = {
      saveLatest: vi.fn(async () => undefined),
    };
    const useCase = new GetMarketsUseCase(provider, repository);

    await expect(useCase.execute(request)).resolves.toEqual({
      markets,
      quoteCurrency: QuoteCurrency.create('usd'),
    });
    expect(provider.getMarkets).toHaveBeenCalledWith({
      coinIds: [CoinId.create('bitcoin')],
      quoteCurrency: QuoteCurrency.create('usd'),
    });
    expect(repository.saveLatest).toHaveBeenCalledWith(
      markets,
      QuoteCurrency.create('usd'),
    );
  });
});
