import type { z } from 'zod';
import { ZUserDraft } from '@/entities/user';

export const ZCreateUserInput = ZUserDraft;
export type TCreateUserInput = z.infer<typeof ZCreateUserInput>;

export { USER_ROLES } from '@/entities/user';
