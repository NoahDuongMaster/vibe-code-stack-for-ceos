import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Cloudflare Workers receive env vars via bindings, not process.env.
// Use globalThis.process to prevent Vite from inlining this check at build time.
// During wrangler upload, SESSION_SECRET won't exist in process.env → skip validation.
const skipValidation = !globalThis.process?.env?.SESSION_SECRET;

const env = {
  client: createEnv({
    client: {
      NEXT_PUBLIC_PROJECT_NAME: z.string().min(1),
      NEXT_PUBLIC_API_ENDPOINT: z.string().min(1).includes('http').nullish(),
      NEXT_PUBLIC_BASE_URL: z.string().url(),
      NEXT_PUBLIC_CORS_COOKIE: z.string().nullish(),
      NEXT_PUBLIC_DEBUG: z.string().nullish(),
      NEXT_PUBLIC_SENTRY_DSN: z.string().url().nullish(),
    },
    runtimeEnv: {
      NEXT_PUBLIC_PROJECT_NAME: process.env.NEXT_PUBLIC_PROJECT_NAME,
      NEXT_PUBLIC_API_ENDPOINT: process.env.NEXT_PUBLIC_API_ENDPOINT,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
      NEXT_PUBLIC_CORS_COOKIE: process.env.NEXT_PUBLIC_CORS_COOKIE,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
    skipValidation,
  }),

  server: createEnv({
    server: {
      SESSION_SECRET: z.string().min(32),
      CORS_ORIGINS: z.string().nullish(),
      CORS_RESOURCE: z.string().nullish(),
    },
    experimental__runtimeEnv: process.env,
    skipValidation,
  }),
};

export { env };
