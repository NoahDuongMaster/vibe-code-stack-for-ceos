import * as Sentry from '@sentry/node';
import { createServer } from '@/adapters/http.adapter';
import { parseRuntimeConfig } from '@/config/runtime-config';
import {
  createCoinGeckoMarketDataProvider,
  GetCryptoMarketsUseCase,
} from './features/get-crypto-markets/index.js';

/**
 * TIER 2 — Node.js driving adapter (heavy / stateful services).
 *
 * COMPOSITION ROOT (see AGENTS.md § Backend architecture): the only place env is
 * read and dependencies are wired — validates env, inits Sentry, builds the
 * server (the Fastify inbound adapter), and owns graceful shutdown. No business
 * logic. Full runtime: fs, native crypto, long-running compute, no CPU cap.
 */

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Awaited<ReturnType<typeof createServer>> | undefined;
let shuttingDown = false;

function reportError(error: unknown, message: string): void {
  server?.log.error({ err: error }, message);
  Sentry.captureException(error);
}

async function gracefulShutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  server?.log.info('Shutting down gracefully');
  const forced = setTimeout(() => {
    server?.log.fatal({ exitCode }, 'Forced shutdown after timeout');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  try {
    await server?.close();
    server?.log.info('Server closed');
  } finally {
    clearTimeout(forced);
    try {
      await Sentry.close(2_000);
    } finally {
      process.exit(exitCode);
    }
  }
}

process.on('SIGTERM', () => void gracefulShutdown(0));
process.on('SIGINT', () => void gracefulShutdown(0));

process.on('unhandledRejection', (reason) => {
  reportError(reason, 'Unhandled promise rejection');
  void gracefulShutdown(1);
});

process.on('uncaughtException', (err) => {
  reportError(err, 'Uncaught exception');
  void gracefulShutdown(1);
});

async function main() {
  // The composition root is the sole reader of process.env. Every value is
  // validated before it is passed into infrastructure or application wiring.
  const config = parseRuntimeConfig(process.env);
  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.nodeEnv,
      tracesSampleRate: 0.1,
    });
  }

  server = await createServer({
    getCryptoMarkets: new GetCryptoMarketsUseCase(
      createCoinGeckoMarketDataProvider({
        apiKey: config.coingeckoApiKey,
      }),
    ),
    corsOrigins: config.corsOrigins,
    http2: config.rpcTransport === 'http2',
    maxBodyBytes: config.maxBodyBytes,
    requestTimeoutMs: config.requestTimeoutMs,
    rateLimit: config.rateLimit,
    rateLimitWindowMs: config.rateLimitWindowMs,
  });

  const address = await server.listen({ port: config.port, host: '0.0.0.0' });
  server.log.info(
    { address, rpcTransport: config.rpcTransport },
    'Connect RPC server is listening',
  );
}

main().catch((err) => {
  reportError(err, 'Failed to start trading RPC');
  void gracefulShutdown(1);
});
