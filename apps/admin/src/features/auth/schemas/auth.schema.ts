import { z } from 'zod';

export const ZLoginInput = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type TLoginInput = z.infer<typeof ZLoginInput>;

export const ZAuthUser = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});
export type TAuthUser = z.infer<typeof ZAuthUser>;

export type TAuthSession = {
  token: string;
  user: TAuthUser;
};
