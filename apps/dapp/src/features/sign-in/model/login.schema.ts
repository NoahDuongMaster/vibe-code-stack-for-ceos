import { z } from 'zod';

/** Body accepted by `POST /api/auth/login` — verified server-side, never trusted as-is. */
export const ZLoginInput = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type TLoginInput = z.infer<typeof ZLoginInput>;
