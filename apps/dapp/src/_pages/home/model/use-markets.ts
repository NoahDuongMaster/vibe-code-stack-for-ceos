'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import { getMarkets } from '@/_pages/home/api/get-markets.api';
import {
  MARKET_QUERY_KEY,
  MARKET_REFRESH_INTERVAL_MS,
} from '@/_pages/home/model/market.constants';

export const marketQueryOptions = queryOptions({
  queryKey: MARKET_QUERY_KEY,
  queryFn: ({ signal }) => getMarkets(signal),
  staleTime: MARKET_REFRESH_INTERVAL_MS,
  refetchInterval: MARKET_REFRESH_INTERVAL_MS,
  retry: 2,
});

export const useMarkets = () => useQuery(marketQueryOptions);
