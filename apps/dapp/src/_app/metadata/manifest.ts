import type { MetadataRoute } from 'next';
import { APP_DESCRIPTION, APP_NAME } from '@/_app/metadata/app-metadata';

export const createManifest = (): MetadataRoute.Manifest => ({
  name: APP_NAME,
  short_name: APP_NAME,
  description: APP_DESCRIPTION,
  start_url: '/',
  display: 'standalone',
  background_color: '#071018',
  theme_color: '#071018',
  categories: ['finance', 'utilities'],
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
