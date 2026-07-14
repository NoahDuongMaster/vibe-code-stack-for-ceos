import type { MetadataRoute } from 'next';

export const createManifest = (): MetadataRoute.Manifest => ({
  name: 'AI-First Next.js Boilerplate',
  short_name: 'AI-First Next.js',
  description:
    'Production-ready Next.js 16 boilerplate with Feature-Sliced Design v2.1, built for AI-assisted development.',
  start_url: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#000000',
  icons: [
    {
      src: '/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: '/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
  ],
});
