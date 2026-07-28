import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const env = {
  client: createEnv({
    client: {
      NEXT_PUBLIC_PROJECT_NAME: z.string().min(1),
      NEXT_PUBLIC_API_ENDPOINT: z.url(),
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
    // Treat empty env strings (e.g. `NEXT_PUBLIC_SENTRY_DSN=`) as undefined so
    // optional `.url().nullish()` vars don't fail validation when left blank.
    emptyStringAsUndefined: true,
  }),

  server: createEnv({
    server: {
      SESSION_SECRET: z.string().min(32),
      // Reference credential for the demo login flow (features/sign-in) — see
      // its server verifier for where a real IdP check would replace this.
      DEMO_AUTH_EMAIL: z.email(),
      DEMO_AUTH_PASSWORD: z.string().min(1),
      DAPP_LOGIN_RATE_LIMIT_MODE: z.enum(['local', 'distributed']).optional(),
      CORS_ORIGINS: z.string().nullish(),
      CORS_RESOURCE: z.string().nullish(),
    },
    experimental__runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  }),
};

export { env };
