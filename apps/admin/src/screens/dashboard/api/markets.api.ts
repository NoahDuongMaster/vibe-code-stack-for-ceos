import {
  MARKET_COIN_IDS,
  MARKET_QUOTE_CURRENCY,
} from '@/screens/dashboard/model/market.constants';
import { mapMarketsResponse } from '@/screens/dashboard/model/market.mapper';
import type { TMarketsSnapshot } from '@/screens/dashboard/model/market.schema';
import { adminApiClient } from '@/shared/api';

export const getMarkets = async (): Promise<TMarketsSnapshot> => {
  const response = await adminApiClient.getMarkets({
    coinIds: [...MARKET_COIN_IDS],
    vsCurrency: MARKET_QUOTE_CURRENCY,
  });

  return mapMarketsResponse(response);
};
