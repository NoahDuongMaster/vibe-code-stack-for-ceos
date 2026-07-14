import { z } from 'zod';

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
