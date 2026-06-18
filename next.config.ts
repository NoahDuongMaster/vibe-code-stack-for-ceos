import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import type { NextConfig } from 'next';

const jiti = createJiti(fileURLToPath(import.meta.url));

jiti.esmResolve('./src/shared/config/env.configuration.ts');

const isDev = process.env.NODE_ENV !== 'production';

const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!isDev ? ['upgrade-insecure-requests'] : []),
].join('; ');

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
  {
    key: isDev
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy',
    value: cspValue,
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

export default nextConfig;
