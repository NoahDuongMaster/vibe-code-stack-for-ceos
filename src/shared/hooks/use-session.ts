'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TSessionData } from '@/shared/types/session.types';

const SESSION_QUERY_KEY = ['session'] as const;

const fetchSession = async (): Promise<TSessionData> => {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return { isLoggedIn: false };
  return res.json();
};

export const useSession = () => {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 60_000,
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, { isLoggedIn: false });
    },
  });
};
