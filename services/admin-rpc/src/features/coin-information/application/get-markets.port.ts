import type { TCoinMarket } from '@/features/coin-information/domain/coin-market';

export interface TGetMarketsInput {
  coinIds: string[];
  vsCurrency: string;
}

export interface TGetMarketsResult {
  markets: TCoinMarket[];
  vsCurrency: string;
}

export interface GetMarkets {
  execute(input: TGetMarketsInput): Promise<TGetMarketsResult>;
}
