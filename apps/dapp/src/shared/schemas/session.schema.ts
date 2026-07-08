import { z } from 'zod';

/**
 * Single source of truth for the session shape. The client-safe schema is
 * consumed by `features/auth` (public barrel); the server variant extends it
 * with fields that must never reach the browser and is consumed only by
 * `server/lib/session.ts`.
 */

/** Public user shape exposed to the client (never includes server-only fields). */
export const ZSessionUser = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().optional(),
  avatarUrl: z.url().optional(),
});
export type TSessionUser = z.infer<typeof ZSessionUser>;

/** What `GET /api/auth/me` returns to the client. */
export const ZSessionData = z.object({
  isLoggedIn: z.boolean(),
  user: ZSessionUser.optional(),
});
export type TSessionData = z.infer<typeof ZSessionData>;

/** Server-only session user — adds fields that must never leak to the client. */
export const ZServerSessionUser = ZSessionUser.extend({
  accessToken: z.string().optional(),
});
export type TServerSessionUser = z.infer<typeof ZServerSessionUser>;

/** Server-only session shape stored in the iron-session cookie. */
export const ZServerSessionData = z.object({
  isLoggedIn: z.boolean(),
  user: ZServerSessionUser.optional(),
});
export type TServerSessionData = z.infer<typeof ZServerSessionData>;
