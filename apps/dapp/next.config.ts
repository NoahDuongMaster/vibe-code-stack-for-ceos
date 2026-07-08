import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import type { NextConfig } from 'next';

const jiti = createJiti(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// `jiti.import` actually executes the module (unlike the previous
// `jiti.esmResolve`, which only resolves its file path and never runs it —
// so env validation silently never ran at build time). Executing it here
// triggers `createEnv()`'s validation as a real build-time gate, and also
// gives us the validated values to use below instead of raw `process.env`.
const { env } = await jiti.import<
  typeof import('./src/shared/config/env.configuration.ts')
>('./src/shared/config/env.configuration.ts');

const pkg = require('./package.json') as { version: string };

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'debug'] }
        : false,
  },
  experimental: {
    optimizePackageImports: ['@ark-ui/react', 'lucide-react', 'motion'],
    serverActions: {
      allowedOrigins: env.server.CORS_ORIGINS?.split(','),
    },
    webVitalsAttribution: ['FCP', 'TTFB'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: process.env.NODE_ENV === 'production' ? 60 : 0,
    remotePatterns:
      env.server.CORS_RESOURCE?.split(',').map((remote) => ({
        hostname: remote,
      })) ?? [],
  },
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV !== 'production',
    },
  },
  output: 'standalone',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
};

// Only apply Sentry webpack wrapper for `next build` (Docker/Node.js).
// vinext (Vite-based) does not support webpack — skip to avoid the warning.
const sentryEnabled = !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT;

let config: NextConfig = nextConfig;

if (sentryEnabled) {
  const { withSentryConfig } = await import('@sentry/nextjs');
  config = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    release: { name: pkg.version },
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',
  });
}

// `pnpm analyze` sets ANALYZE=true, but this wrapper was never applied —
// wire it so that flag actually produces a bundle report. Same webpack-only
// caveat as Sentry above: no-op under vinext/Vite.
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = (await import('@next/bundle-analyzer')).default({
    enabled: true,
  });
  config = withBundleAnalyzer(config);
}

export default config;
