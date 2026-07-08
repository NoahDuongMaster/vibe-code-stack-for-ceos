import * as Sentry from '@sentry/node';
import { createServer } from './server';

/**
 * TIER 2 — Node.js adapter (heavy / stateful services).
 * Full runtime: fs, native crypto, long-running compute, no CPU cap.
 * Serves ApiService over Connect / gRPC / gRPC-web via the official Node adapter.
 */

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}

// A malformed numeric env var (e.g. MAX_BODY_BYTES="5mb") must fail loudly,
// not silently coerce to NaN — `NaN > x` and `x > NaN` are both always
// false, which would disable the body-size cap and turn `server.listen(NaN)`
// into a random OS-assigned port.
function requireIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${name}: "${raw}" is not a number`);
  }
  return value;
}

const PORT = requireIntEnv('PORT', 3001);
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createServer({
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxBodyBytes: requireIntEnv('MAX_BODY_BYTES', 5 * 1024 * 1024),
  requestTimeoutMs: requireIntEnv('REQUEST_TIMEOUT_MS', 30_000),
  rateLimit: requireIntEnv('RATE_LIMIT', 300),
  rateLimitWindowMs: requireIntEnv('RATE_LIMIT_WINDOW_MS', 60_000),
});

let shuttingDown = false;
function gracefulShutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[api-node] Shutting down gracefully...');
  server.close(() => {
    console.log('[api-node] Server closed.');
    process.exit(exitCode);
  });
  setTimeout(() => {
    console.error('[api-node] Forced shutdown after timeout.');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', () => gracefulShutdown(0));
process.on('SIGINT', () => gracefulShutdown(0));

process.on('unhandledRejection', (reason) => {
  console.error('[api-node] Unhandled rejection:', reason);
  Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
  console.error('[api-node] Uncaught exception:', err);
  Sentry.captureException(err);
  gracefulShutdown(1);
});

server.listen(PORT, () => {
  console.log(`[api-node] Connect RPC listening on http://localhost:${PORT}`);
});
