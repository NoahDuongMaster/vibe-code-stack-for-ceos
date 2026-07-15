import { readFileSync } from 'node:fs';
import * as Sentry from '@sentry/node';
import { createServer } from '@/adapters/http.adapter';
import { parseRuntimeConfig } from '@/config/runtime-config';
import { resolveRuntimeEnvironment } from '@/config/runtime-environment';
import {
  createCoinGeckoMarketDataProvider,
  createDrizzleMarketSnapshotRepository,
} from '@/features/market-data';
import { resolveFastifyLoggerOptions } from '@/platform/fastify/logger-options';

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
  server?.getHttpAdapter().getInstance().log.error({ err: error }, message);
  Sentry.captureException(error);
}

async function gracefulShutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  server?.getHttpAdapter().getInstance().log.info('Shutting down gracefully');
  const forced = setTimeout(() => {
    server
      ?.getHttpAdapter()
      .getInstance()
      .log.fatal({ exitCode }, 'Forced shutdown after timeout');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  try {
    await server?.close();
  } finally {
    clearTimeout(forced);
    if (!server) await Sentry.close(2_000);
    process.exit(exitCode);
  }
}

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
  const config = parseRuntimeConfig(
    resolveRuntimeEnvironment(process.env, (path) =>
      readFileSync(path, 'utf8'),
    ),
  );
  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.nodeEnv,
      tracesSampleRate: 0.1,
    });
    Sentry.setTag('service', config.serviceName);
  }

  server = await createServer({
    serviceName: config.serviceName,
    marketDataProvider: createCoinGeckoMarketDataProvider({
      apiKey: config.coingeckoApiKey,
    }),
    marketSnapshotRepository: createDrizzleMarketSnapshotRepository({
      connectionString: config.databaseUrl,
      maxConnections: config.databasePoolMax,
      connectionTimeoutMs: config.databaseConnectionTimeoutMs,
      idleTimeoutMs: config.databaseIdleTimeoutMs,
    }),
    corsOrigins: config.corsOrigins,
    grpcUrl: `0.0.0.0:${config.grpcPort}`,
    http2: config.rpcTransport === 'http2',
    logger: resolveFastifyLoggerOptions(config.nodeEnv),
    maxBodyBytes: config.maxBodyBytes,
    requestTimeoutMs: config.requestTimeoutMs,
    rateLimit: config.rateLimit,
    rateLimitWindowMs: config.rateLimitWindowMs,
  });

  // Run Nest bootstrap hooks (including PostgreSQL migration/readiness) before
  // exposing either RPC listener.
  await server.init();
  await server.startAllMicroservices();
  await server.listen(config.port, '0.0.0.0');
  const address = await server.getUrl();
  server
    .getHttpAdapter()
    .getInstance()
    .log.info(
      {
        serviceName: config.serviceName,
        connectAddress: address,
        grpcAddress: `0.0.0.0:${config.grpcPort}`,
        rpcTransport: config.rpcTransport,
      },
      'Nest trading RPC service is listening',
    );
}

main().catch((err) => {
  reportError(err, 'Failed to start trading RPC');
  void gracefulShutdown(1);
});
