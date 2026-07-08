import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TCreateUserInput } from '../schemas/user.schema';
import { userService } from '../services/user.service';

const USERS_QUERY_KEY = ['users'] as const;

export const useUsers = () =>
  useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => userService.list(),
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TCreateUserInput) => userService.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
};
