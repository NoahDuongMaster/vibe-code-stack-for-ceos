import { useQuery } from '@tanstack/react-query';
import { healthService } from '../services/health.service';

/** Polls backend health via TanStack Query (server-state parity with dapp). */
export const useHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: () => healthService.check(),
    refetchInterval: 30_000,
    retry: 1,
  });
