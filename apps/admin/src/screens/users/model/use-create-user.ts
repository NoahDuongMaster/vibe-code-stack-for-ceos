import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser, USERS_QUERY_KEY } from '@/entities/user';
import type { TCreateUserInput } from '@/screens/users/model/create-user.schema';

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TCreateUserInput) => createUser(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}
