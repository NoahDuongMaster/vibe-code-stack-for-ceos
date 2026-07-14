import type { CoinId } from '@/domain/crypto-market/coin-id';
import type { MarketSnapshot } from '@/domain/crypto-market/market-snapshot';
import type { QuoteCurrency } from '@/domain/crypto-market/quote-currency';

/** Domain request understood by any external market-data implementation. */
export interface MarketDataQuery {
  coinIds: readonly CoinId[];
  quoteCurrency: QuoteCurrency;
}

/** Outbound port. Infrastructure providers implement this contract. */
export interface MarketDataProvider {
  getMarkets(query: MarketDataQuery): Promise<readonly MarketSnapshot[]>;
}
