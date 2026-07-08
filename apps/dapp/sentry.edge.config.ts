import * as Sentry from '@sentry/nextjs';
import { env } from '@/shared/config/env.configuration';

Sentry.init({
  dsn: env.client.NEXT_PUBLIC_SENTRY_DSN ?? undefined,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,
});
