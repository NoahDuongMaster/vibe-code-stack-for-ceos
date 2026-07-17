'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logoutAction } from '@/_pages/account/api/logout.action';
import { SESSION_QUERY_KEY } from '@/entities/session';

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
