import type { Metadata } from 'next';
import { env } from '@/shared/config/env.configuration';

const META_DATA_DEFAULT: Metadata = {
  applicationName: 'NextJS Boilerplate',
  authors: {
    name: 'Noah Duong',
    url: 'https://duongnamtruong.com',
  },
  creator: 'Noah Duong',
  description:
    'A super powerful NextJS boilerplate developed following the Feature driven pattern',
  keywords: [
    'nextjs',
    'boilerplate',
    'typescript',
    'feature driven',
    'noah duong',
  ],
  title: {
    default: 'Home',
    template: '%s | NextJS Boilerplate',
  },
  metadataBase: new URL(env.client.NEXT_PUBLIC_BASE_URL ?? ''),
};

export { META_DATA_DEFAULT };
