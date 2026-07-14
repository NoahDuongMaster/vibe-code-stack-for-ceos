import type { MarketDataQuery } from '../domain/market-data-provider.port';
import type { MarketSnapshot } from '../domain/market-snapshot';

/**
 * Application input port for retrieving current crypto market snapshots.
 * Driving adapters depend on this contract, not on a concrete use case.
 */
export interface GetCryptoMarkets {
  execute(query: MarketDataQuery): Promise<readonly MarketSnapshot[]>;
}
