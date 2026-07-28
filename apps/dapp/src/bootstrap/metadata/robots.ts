import type { MetadataRoute } from 'next';
import { env } from '@/shared/config';

export const createRobots = (): MetadataRoute.Robots => {
  const baseUrl = env.client.NEXT_PUBLIC_BASE_URL;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/private/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
};
