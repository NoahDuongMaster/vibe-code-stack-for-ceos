'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logoutAction } from '../actions/auth.action';
import type { TLoginInput, TSessionData } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';

const SESSION_QUERY_KEY = ['auth', 'session'] as const;

// `initialData` lets a Server Component seed the query from `getServerSession()`
// so the client doesn't refetch `/api/auth/me` on first paint.
export const useSession = (initialData?: TSessionData) =>
  useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => authService.getSession(),
    staleTime: 60_000,
    initialData,
  });

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TLoginInput) => authService.login(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await logoutAction();
      if (res?.serverError) throw new Error(res.serverError);
      return res?.data;
    },
    onSuccess: () =>
      queryClient.setQueryData(SESSION_QUERY_KEY, { isLoggedIn: false }),
  });
};
