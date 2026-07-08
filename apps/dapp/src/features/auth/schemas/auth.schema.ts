import { z } from 'zod';

// Session types are the single source of truth in `@/shared/schemas/session.schema`
// (server/lib/session.ts depends on the same schema — see CLAUDE.md's dependency
// direction: features/ and server/lib/ both point at shared/, never at each other).
export type {
  TSessionData,
  TSessionUser,
} from '@/shared/schemas/session.schema';
export { ZSessionData, ZSessionUser } from '@/shared/schemas/session.schema';

/** Body accepted by `POST /api/auth/login` — verified server-side, never trusted as-is. */
export const ZLoginInput = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type TLoginInput = z.infer<typeof ZLoginInput>;
