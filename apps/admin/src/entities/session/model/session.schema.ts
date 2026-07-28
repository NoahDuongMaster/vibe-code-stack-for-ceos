import { z } from 'zod';

export const ZAuthUser = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});
export type TAuthUser = z.infer<typeof ZAuthUser>;

export const ZAuthSession = z.object({
  token: z.string().min(1),
  user: ZAuthUser,
});
export type TAuthSession = z.infer<typeof ZAuthSession>;
