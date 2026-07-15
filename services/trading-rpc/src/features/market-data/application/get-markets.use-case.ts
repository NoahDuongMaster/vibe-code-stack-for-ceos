import type {
  GetMarkets,
  TGetMarketsInput,
  TGetMarketsResult,
} from '@/features/market-data/application/get-markets.port';
import { CoinId } from '@/features/market-data/domain/coin-id';
import type { MarketDataProvider } from '@/features/market-data/domain/market-data-provider.port';
import type { MarketSnapshotRepository } from '@/features/market-data/domain/market-snapshot.repository.port';
import { QuoteCurrency } from '@/features/market-data/domain/quote-currency';

/**
 * Application service for the crypto-market read use case. It coordinates the
 * domain port without knowing which provider or transport is in use.
 */
export class GetMarketsUseCase implements GetMarkets {
  constructor(
    private readonly marketDataProvider: MarketDataProvider,
    private readonly marketSnapshotRepository: MarketSnapshotRepository,
  ) {}

  async execute(input: TGetMarketsInput): Promise<TGetMarketsResult> {
    const quoteCurrency = QuoteCurrency.create(input.quoteCurrency);
    const markets = await this.marketDataProvider.getMarkets({
      coinIds: input.coinIds.map(CoinId.create),
      quoteCurrency,
    });
    await this.marketSnapshotRepository.saveLatest(markets, quoteCurrency);

    return { markets, quoteCurrency };
  }
}
