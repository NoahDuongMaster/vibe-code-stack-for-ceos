'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY } from '@/entities/session';
import { login } from '../api/login.api';

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  });
};
