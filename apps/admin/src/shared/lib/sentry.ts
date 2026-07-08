import * as Sentry from '@sentry/react';
import { env } from '@/shared/config/env';

/**
 * Initialise Sentry error monitoring — only when a DSN is configured, and only
 * reports in production builds. A no-op otherwise, so local dev stays quiet.
 */
export function initSentry() {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    enabled: import.meta.env.PROD,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}
