export { createTradingServiceRoutes } from '@/features/market-data/adapters/connect/trading-service.routes';
export type {
  GetMarkets,
  TGetMarketsInput,
  TGetMarketsResult,
} from '@/features/market-data/application/get-markets.port';
export { GetMarketsUseCase } from '@/features/market-data/application/get-markets.use-case';
export type { MarketDataProvider } from '@/features/market-data/domain/market-data-provider.port';
export type { MarketSnapshotPrimitives } from '@/features/market-data/domain/market-snapshot';
export type { MarketSnapshotRepository } from '@/features/market-data/domain/market-snapshot.repository.port';
export { createCoinGeckoMarketDataProvider } from '@/features/market-data/infra/coingecko/coingecko-market-data.adapter';
export {
  createDrizzleMarketSnapshotRepository,
  type TDrizzleMarketSnapshotRepositoryOptions,
} from '@/features/market-data/infra/postgres/drizzle-market-snapshot.repository';
export {
  MarketDataModule,
  type TMarketDataModuleOptions,
} from '@/features/market-data/market-data.module';
export {
  GET_MARKETS,
  MARKET_SNAPSHOT_REPOSITORY,
} from '@/features/market-data/market-data.tokens';
