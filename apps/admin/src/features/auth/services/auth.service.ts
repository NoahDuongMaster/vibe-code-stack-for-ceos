import { loginAPI } from '../adapters/auth.adapter';
import type { TLoginInput } from '../schemas/auth.schema';

export const authService = {
  login: (input: TLoginInput) => loginAPI(input),
};
