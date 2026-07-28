import type { Metadata, Viewport } from 'next';
import { env } from '@/shared/config';

const baseUrl = env.client.NEXT_PUBLIC_BASE_URL;

const APP_NAME = 'Vibe Markets';
const APP_DESCRIPTION =
  'A live crypto market command deck powered by typed ConnectRPC data and an interactive WebGL scene.';

const META_DATA_DEFAULT: Metadata = {
  applicationName: APP_NAME,
  authors: {
    name: 'Noah Duong',
    url: 'https://duongnamtruong.com',
  },
  creator: 'Noah Duong',
  description: APP_DESCRIPTION,
  keywords: [
    'crypto market dashboard',
    'cryptocurrency prices',
    'WebGL market visualization',
    'ConnectRPC',
    'Three.js',
    'React Three Fiber',
    'Next.js 16',
    'React 19',
    'TypeScript',
    'TanStack Query',
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
  colorScheme: 'dark',
  themeColor: '#071018',
};

export { APP_DESCRIPTION, APP_NAME, META_DATA_DEFAULT, VIEWPORT_DEFAULT };
