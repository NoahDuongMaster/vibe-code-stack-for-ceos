import { ofetch } from 'ofetch';

/**
 * Base HTTP client every feature adapter calls instead of raw `fetch()`
 * (CLAUDE.md hard rule: adapters call `shared/lib/xhr.ts`, never `fetch()`
 * directly). No `baseURL` is set here — same-origin BFF routes (this app's
 * own `app/api/**` route handlers) resolve relative paths as-is. An adapter
 * that talks to an external API should derive its own instance via
 * `xhr.create({ baseURL: ... })` rather than baking one external origin into
 * this shared client.
 */
export const xhr = ofetch.create({
  credentials: 'include',
});

export { FetchError } from 'ofetch';
