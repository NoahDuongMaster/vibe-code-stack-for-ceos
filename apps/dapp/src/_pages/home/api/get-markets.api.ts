import {
  MARKET_COIN_IDS,
  MARKET_QUOTE_CURRENCY,
} from '@/_pages/home/model/market.constants';
import { MarketDataUnavailableError } from '@/_pages/home/model/market.error';
import { mapMarketsResponse } from '@/_pages/home/model/market.mapper';
import type { TMarketsSnapshot } from '@/_pages/home/model/market.schema';
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
