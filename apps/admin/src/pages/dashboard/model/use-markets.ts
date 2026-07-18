import { queryOptions, useQuery } from '@tanstack/react-query';
import { getMarkets } from '@/pages/dashboard/api/markets.api';
import {
  MARKET_QUERY_KEY,
  MARKET_REFRESH_INTERVAL_MS,
} from '@/pages/dashboard/model/market.constants';

export const marketQueryOptions = queryOptions({
  queryKey: MARKET_QUERY_KEY,
  queryFn: ({ signal }) => getMarkets(signal),
  staleTime: MARKET_REFRESH_INTERVAL_MS,
  refetchInterval: MARKET_REFRESH_INTERVAL_MS,
  retry: 2,
});

export const useMarkets = () => useQuery(marketQueryOptions);
