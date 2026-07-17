import { useQuery } from '@tanstack/react-query';
import { getUsers } from '@/entities/user/api/user.api';

export const USERS_QUERY_KEY = ['users'] as const;

export const useUsers = () =>
  useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: getUsers,
  });
