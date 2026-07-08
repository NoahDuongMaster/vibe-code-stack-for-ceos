import sitemap from '@astrojs/sitemap';
import sentry from '@sentry/astro';
import { defineConfig } from 'astro/config';

// Sentry is DSN-gated: only wire the integration when PUBLIC_SENTRY_DSN is set.
// The DSN is read from the process environment — set it as a build-time env var
// (this app deploys as a Cloudflare Worker serving static assets, see
// wrangler.jsonc, not Cloudflare Pages — provide it via `wrangler secret put` /
// CI env, not a committed .env). With no DSN the default build stays clean with
// Sentry effectively off. Source-map upload is disabled, so no Sentry auth
// token is required to build.
//
// Tradeoff: this landing page is otherwise zero-JS (pre-rendered static HTML).
// Setting PUBLIC_SENTRY_DSN pulls in the Sentry browser SDK and turns it into a
// JS-shipping page — enable it deliberately, not by default, and re-check the
// bundle after doing so.
const sentryDsn = process.env.PUBLIC_SENTRY_DSN;

const integrations = [
  sitemap(),
  ...(sentryDsn
    ? [
        sentry({
          dsn: sentryDsn,
          sourceMapsUploadOptions: { enabled: false },
        }),
      ]
    : []),
];

// Static landing page (default output) — ships as pre-rendered HTML with
// ~zero JS. Build output goes to dist/ and is served from Cloudflare
// Workers static assets (see wrangler.jsonc). Add an adapter later only
// if you introduce on-demand rendering / server islands.
export default defineConfig({
  // No real production domain is documented anywhere in this repo yet.
  // Set PUBLIC_SITE_URL as a build-time env var once the domain is known;
  // until then this falls back to the Workers *.workers.dev default so
  // canonical URLs/OpenGraph/sitemap are at least self-consistent rather than
  // pointing at a placeholder that was never real.
  // TODO: replace the fallback below with the real domain before launch.
  site: process.env.PUBLIC_SITE_URL ?? 'https://landing.workers.dev',
  integrations,
});
