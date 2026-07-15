import type { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';
import type { QuoteCurrency } from '@/features/market-data/domain/quote-currency';

/** Outbound persistence port for the latest provider-neutral market state. */
export interface MarketSnapshotRepository {
  saveLatest(
    snapshots: readonly MarketSnapshot[],
    quoteCurrency: QuoteCurrency,
  ): Promise<void>;
}
