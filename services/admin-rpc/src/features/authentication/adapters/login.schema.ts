import { z } from 'zod';

export const ZLoginRequest = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type TLoginRequest = z.infer<typeof ZLoginRequest>;
