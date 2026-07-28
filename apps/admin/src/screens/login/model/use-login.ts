import { useMutation } from '@tanstack/react-query';
import { useSessionStore } from '@/entities/session';
import { login } from '@/screens/login/api/login.api';
import type { TLoginInput } from '@/screens/login/model/login.schema';

export const useLogin = () => {
  const signIn = useSessionStore((state) => state.signIn);
  return useMutation({
    mutationFn: (input: TLoginInput) => login(input),
    onSuccess: (session) => signIn(session),
  });
};
