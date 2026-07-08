import type { APIRoute } from 'astro';

// Generated at build time from `site` (astro.config.mjs's `site`, itself
// derived from PUBLIC_SITE_URL) instead of a static public/robots.txt with a
// hardcoded domain — that file previously pointed crawlers at the old
// Cloudflare Pages deployment regardless of where this build actually ships.
// The staging worker (ai-first-landing-staging, see wrangler.jsonc) would
// otherwise be indexable as duplicate content, so it's excluded by hostname.
export const GET: APIRoute = ({ site }) => {
  const isStaging = site?.hostname.includes('staging') ?? false;

  const body = isStaging
    ? 'User-agent: *\nDisallow: /\n'
    : [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', site).href}`,
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
