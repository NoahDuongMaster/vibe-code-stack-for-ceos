import type { Metadata, Viewport } from 'next';
import { env } from '@/shared/config/env.configuration';

const baseUrl = env.client.NEXT_PUBLIC_BASE_URL;

const APP_NAME = 'AI-First Next.js Boilerplate';
const APP_DESCRIPTION =
  'Production-ready Next.js 16 boilerplate with vertical slice architecture, built for AI-assisted development with Claude, Cursor, Copilot, and more.';

const META_DATA_DEFAULT: Metadata = {
  applicationName: APP_NAME,
  authors: {
    name: 'Noah Duong',
    url: 'https://duongnamtruong.com',
  },
  creator: 'Noah Duong',
  description: APP_DESCRIPTION,
  keywords: [
    'nextjs boilerplate',
    'ai-first development',
    'vertical slice architecture',
    'nextjs 16',
    'typescript',
    'panda css',
    'ark ui',
    'tanstack query',
    'zustand',
    'react 19',
  ],
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  metadataBase: new URL(baseUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: baseUrl,
    siteName: APP_NAME,
    title: {
      default: APP_NAME,
      template: `%s | ${APP_NAME}`,
    },
    description: APP_DESCRIPTION,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: APP_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: {
      default: APP_NAME,
      template: `%s | ${APP_NAME}`,
    },
    description: APP_DESCRIPTION,
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: baseUrl,
  },
};

const VIEWPORT_DEFAULT: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export { APP_DESCRIPTION, APP_NAME, META_DATA_DEFAULT, VIEWPORT_DEFAULT };
