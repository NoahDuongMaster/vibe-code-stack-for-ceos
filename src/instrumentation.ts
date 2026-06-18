import type { Instrumentation } from 'next';

// TODO: Integrate with Sentry or DataDog for production error tracking
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  if (process.env.NODE_ENV === 'production') {
    // biome-ignore lint/suspicious/noConsole: production error telemetry before monitoring service integration
    console.error('[onRequestError]', {
      error,
      route: request.path,
      method: request.method,
      routeType: context.routeType,
    });
  }
};
