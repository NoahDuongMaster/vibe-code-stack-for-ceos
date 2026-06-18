import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const env = {
  client: createEnv({
    client: {
      NEXT_PUBLIC_PROJECT_NAME: z.string().min(1),
      NEXT_PUBLIC_API_ENDPOINT: z.string().min(1).includes('http').nullish(),
      NEXT_PUBLIC_BASE_URL: z.string().min(1).includes('http').nullish(),
      NEXT_PUBLIC_CORS_COOKIE: z.string().nullish(),
      NEXT_PUBLIC_DEBUG: z.string().nullish(),
    },
    runtimeEnv: {
      NEXT_PUBLIC_PROJECT_NAME: process.env.NEXT_PUBLIC_PROJECT_NAME,
      NEXT_PUBLIC_API_ENDPOINT: process.env.NEXT_PUBLIC_API_ENDPOINT,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
      NEXT_PUBLIC_CORS_COOKIE: process.env.NEXT_PUBLIC_CORS_COOKIE,
    },
  }),

  server: createEnv({
    server: {
      CORS_ORIGIN: z.string().nullish(),
      CORS_RESOURCE: z.string().nullish(),
    },
    experimental__runtimeEnv: process.env,
  }),
};

export { env };
