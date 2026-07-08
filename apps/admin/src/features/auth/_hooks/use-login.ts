import { useMutation } from '@tanstack/react-query';
import type { TLoginInput } from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/auth.store';

export const useLogin = () => {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: (input: TLoginInput) => authService.login(input),
    onSuccess: (session) => signIn(session),
  });
};
