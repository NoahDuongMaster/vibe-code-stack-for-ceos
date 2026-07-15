import type { CoinId } from '@/features/market-data/domain/coin-id';
import type { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';
import type { QuoteCurrency } from '@/features/market-data/domain/quote-currency';

/** Domain request understood by any external market-data implementation. */
export interface MarketDataQuery {
  coinIds: readonly CoinId[];
  quoteCurrency: QuoteCurrency;
}

/** Outbound port. Infrastructure providers implement this contract. */
export interface MarketDataProvider {
  getMarkets(query: MarketDataQuery): Promise<readonly MarketSnapshot[]>;
}
