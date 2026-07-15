import type { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';
import type { QuoteCurrency } from '@/features/market-data/domain/quote-currency';

export interface TGetMarketsInput {
  coinIds: readonly string[];
  quoteCurrency: string;
}

export interface TGetMarketsResult {
  markets: readonly MarketSnapshot[];
  quoteCurrency: QuoteCurrency;
}

/**
 * Application input port for retrieving current crypto market snapshots.
 * Driving adapters depend on this contract, not on a concrete use case.
 */
export interface GetMarkets {
  execute(input: TGetMarketsInput): Promise<TGetMarketsResult>;
}
