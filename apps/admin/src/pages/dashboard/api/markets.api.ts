import {
  MARKET_COIN_IDS,
  MARKET_QUOTE_CURRENCY,
} from '@/pages/dashboard/model/market.constants';
import { mapMarketsResponse } from '@/pages/dashboard/model/market.mapper';
import type { TMarketsSnapshot } from '@/pages/dashboard/model/market.schema';
import { adminApiClient } from '@/shared/api';

export const getMarkets = async (
  signal?: AbortSignal,
): Promise<TMarketsSnapshot> => {
  const response = await adminApiClient.getMarkets(
    {
      coinIds: [...MARKET_COIN_IDS],
      vsCurrency: MARKET_QUOTE_CURRENCY,
    },
    { signal },
  );

  return mapMarketsResponse(response);
};
