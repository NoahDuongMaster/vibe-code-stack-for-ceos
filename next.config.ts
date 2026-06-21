import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import type { NextConfig } from 'next';

const jiti = createJiti(fileURLToPath(import.meta.url));

jiti.esmResolve('./src/shared/config/env.configuration.ts');

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
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
      allowedOrigins: process.env.CORS_ORIGINS?.split(','),
    },
    webVitalsAttribution: ['FCP', 'TTFB'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: process.env.NODE_ENV === 'production' ? 60 : 0,
    remotePatterns:
      process.env.CORS_RESOURCE?.split(',').map((remote) => ({
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
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',
  });
}

export default config;
