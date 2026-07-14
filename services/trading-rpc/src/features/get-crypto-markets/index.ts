export { createTradingServiceRoutes } from './adapters/connect/trading-service.routes';
export type { GetCryptoMarkets } from './application/get-crypto-markets.port';
export { GetCryptoMarketsUseCase } from './application/get-crypto-markets.use-case';
export { createCoinGeckoMarketDataProvider } from './infra/coingecko/coingecko-market-data.adapter';
