import { z } from 'zod';

export const USER_ROLES = ['admin', 'member', 'viewer'] as const;

export const ZUser = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  createdAt: z.string(),
});
export type TUser = z.infer<typeof ZUser>;

export const ZCreateUserInput = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  role: z.enum(USER_ROLES),
});
export type TCreateUserInput = z.infer<typeof ZCreateUserInput>;
