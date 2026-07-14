import { z } from 'zod';

/** Public user shape exposed to the client. */
export const ZSessionUser = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().optional(),
  avatarUrl: z.url().optional(),
});
export type TSessionUser = z.infer<typeof ZSessionUser>;

/** Public session shape returned through RSC and HTTP boundaries. */
export const ZSessionData = z.object({
  isLoggedIn: z.boolean(),
  user: ZSessionUser.optional(),
});
export type TSessionData = z.infer<typeof ZSessionData>;

/** Server-only user shape stored in the encrypted session cookie. */
export const ZServerSessionUser = ZSessionUser.extend({
  accessToken: z.string().optional(),
});
export type TServerSessionUser = z.infer<typeof ZServerSessionUser>;

/** Server-only session shape stored by iron-session. */
export const ZServerSessionData = z.object({
  isLoggedIn: z.boolean(),
  user: ZServerSessionUser.optional(),
});
export type TServerSessionData = z.infer<typeof ZServerSessionData>;
