import * as Sentry from '@sentry/nextjs';
import { env } from '@/shared/config/env.configuration';
import pkg from './package.json';

Sentry.init({
  dsn: env.client.NEXT_PUBLIC_SENTRY_DSN ?? undefined,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV,
  release: pkg.version,
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  // `replaysOnErrorSampleRate: 1.0` means Replay must buffer session activity
  // in the background *before* an error happens, so it can attach a replay
  // once one does — that requires the integration to be included eagerly.
  // Lazy-loading it would only start buffering after the first error, which
  // defeats the point (no pre-error context to attach).
  integrations: [Sentry.replayIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
