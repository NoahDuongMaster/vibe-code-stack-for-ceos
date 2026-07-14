import type {
  MarketDataProvider,
  MarketDataQuery,
} from '../domain/market-data-provider.port';
import type { MarketSnapshot } from '../domain/market-snapshot';
import type { GetCryptoMarkets } from './get-crypto-markets.port';

/**
 * Application service for the crypto-market read use case. It coordinates the
 * domain port without knowing which provider or transport is in use.
 */
export class GetCryptoMarketsUseCase implements GetCryptoMarkets {
  constructor(private readonly marketDataProvider: MarketDataProvider) {}

  execute(query: MarketDataQuery): Promise<readonly MarketSnapshot[]> {
    return this.marketDataProvider.getMarkets(query);
  }
}
