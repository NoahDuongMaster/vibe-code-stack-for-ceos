import {
  MARKET_COIN_IDS,
  MARKET_QUOTE_CURRENCY,
} from '@/screens/home/model/market.constants';
import { MarketDataUnavailableError } from '@/screens/home/model/market.error';
import { mapMarketsResponse } from '@/screens/home/model/market.mapper';
import type { TMarketsSnapshot } from '@/screens/home/model/market.schema';
import { getTradingClient } from '@/shared/api';
import { logger } from '@/shared/lib/logger';

export const getMarkets = async (
  signal?: AbortSignal,
): Promise<TMarketsSnapshot> => {
  try {
    const tradingClient = await getTradingClient();
    const response = await tradingClient.getMarkets(
      {
        coinIds: [...MARKET_COIN_IDS],
        vsCurrency: MARKET_QUOTE_CURRENCY,
      },
      { signal },
    );

    return mapMarketsResponse(response);
  } catch (error) {
    logger.error('[market-dashboard]', error);
    throw new MarketDataUnavailableError({ cause: error });
  }
};
