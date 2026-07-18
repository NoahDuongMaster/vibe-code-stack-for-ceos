import type { TCoinMarket } from '@/features/coin-information/domain/coin-market';

export interface TTradingMarketsInput {
  coinIds: string[];
  vsCurrency: string;
}

export interface TTradingMarketsResult {
  markets: TCoinMarket[];
  vsCurrency: string;
}

/** Driven port for the trading service that owns crypto market data. */
export interface TradingMarketData {
  getMarkets(input: TTradingMarketsInput): Promise<TTradingMarketsResult>;
}
