import type {
  GetMarkets,
  TGetMarketsInput,
  TGetMarketsResult,
} from '@/features/coin-information/application/get-markets.port';
import type { TradingMarketData } from '@/features/coin-information/domain/trading-market-data.port';

/** Admin orchestration delegates market ownership to trading-rpc. */
export class GetMarketsUseCase implements GetMarkets {
  constructor(private readonly tradingMarketData: TradingMarketData) {}

  execute(input: TGetMarketsInput): Promise<TGetMarketsResult> {
    return this.tradingMarketData.getMarkets(input);
  }
}
