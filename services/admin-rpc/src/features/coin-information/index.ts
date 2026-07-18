export { createAdminServiceRoutes } from '@/features/coin-information/adapters/connect/admin-service.routes';
export type {
  GetMarkets,
  TGetMarketsInput,
  TGetMarketsResult,
} from '@/features/coin-information/application/get-markets.port';
export { GetMarketsUseCase } from '@/features/coin-information/application/get-markets.use-case';
export {
  CoinInformationModule,
  type TCoinInformationModuleOptions,
} from '@/features/coin-information/coin-information.module';
export { GET_MARKETS } from '@/features/coin-information/coin-information.tokens';
export type { TradingMarketData } from '@/features/coin-information/domain/trading-market-data.port';
export {
  createTradingRpcMarketData,
  type TTradingRpcMarketDataOptions,
} from '@/features/coin-information/infra/grpc/trading-rpc-market-data.adapter';
