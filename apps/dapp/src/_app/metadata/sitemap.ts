import type { MetadataRoute } from 'next';
import { env } from '@/shared/config';

export const createSitemap = (): MetadataRoute.Sitemap => {
  const baseUrl = env.client.NEXT_PUBLIC_BASE_URL;

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
};
