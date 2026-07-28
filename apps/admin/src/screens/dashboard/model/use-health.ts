import { useQuery } from '@tanstack/react-query';
import { getHealth } from '@/screens/dashboard/api/health.api';

/** Polls backend health via TanStack Query (server-state parity with dapp). */
export const useHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 1,
  });
