import { queryOptions, useQuery } from '@tanstack/react-query';
import { getMarkets } from '@/screens/dashboard/api/markets.api';
import {
  MARKET_QUERY_KEY,
  MARKET_REFRESH_INTERVAL_MS,
} from '@/screens/dashboard/model/market.constants';

export const marketQueryOptions = queryOptions({
  queryKey: MARKET_QUERY_KEY,
  queryFn: getMarkets,
  staleTime: MARKET_REFRESH_INTERVAL_MS,
  refetchInterval: MARKET_REFRESH_INTERVAL_MS,
  retry: 2,
});

export const useMarkets = () => useQuery(marketQueryOptions);
