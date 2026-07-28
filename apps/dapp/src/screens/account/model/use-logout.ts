'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY } from '@/entities/session';
import { logoutAction } from '@/screens/account/api/logout.action';

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
