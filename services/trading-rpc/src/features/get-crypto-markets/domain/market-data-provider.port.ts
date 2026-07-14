import type { CoinId } from './coin-id';
import type { MarketSnapshot } from './market-snapshot';
import type { QuoteCurrency } from './quote-currency';

/** Domain request understood by any external market-data implementation. */
export interface MarketDataQuery {
  coinIds: readonly CoinId[];
  quoteCurrency: QuoteCurrency;
}

/** Outbound port. Infrastructure providers implement this contract. */
export interface MarketDataProvider {
  getMarkets(query: MarketDataQuery): Promise<readonly MarketSnapshot[]>;
}
