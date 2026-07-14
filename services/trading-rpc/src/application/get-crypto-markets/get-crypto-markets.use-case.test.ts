import { describe, expect, it, vi } from 'vitest';
import { GetCryptoMarketsUseCase } from '@/application/get-crypto-markets/get-crypto-markets.use-case';
import { CoinId } from '@/domain/crypto-market/coin-id';
import type { MarketDataProvider } from '@/domain/crypto-market/market-data-provider.port';
import { MarketSnapshot } from '@/domain/crypto-market/market-snapshot';
import { QuoteCurrency } from '@/domain/crypto-market/quote-currency';

describe('GetCryptoMarketsUseCase', () => {
  it('should retrieve snapshots through its injected market-data provider port', async () => {
    const bitcoin = CoinId.create('bitcoin');
    const request = {
      coinIds: [bitcoin],
      quoteCurrency: QuoteCurrency.create('usd'),
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
    const useCase = new GetCryptoMarketsUseCase(provider);

    await expect(useCase.execute(request)).resolves.toEqual(markets);
    expect(provider.getMarkets).toHaveBeenCalledWith(request);
  });
});
