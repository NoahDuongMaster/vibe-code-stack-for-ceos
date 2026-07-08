// Single source of truth for the session cookie name — shared between
// `server/lib/session.ts` (creates/reads the sealed cookie) and `proxy.ts`
// (Edge middleware, validates the cookie without pulling in `next/headers`).
export const SESSION_COOKIE_NAME = 'app-session';

// Shared between `server/lib/session.ts` (cookie maxAge + iron-session seal
// ttl) and `proxy.ts` (unsealData's ttl). iron-session defaults `ttl` to 14
// days independently of `cookieOptions.maxAge` — without passing this
// explicitly in both places, a captured cookie stays cryptographically valid
// a week past the cookie's own expiry.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
