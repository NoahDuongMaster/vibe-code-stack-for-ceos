import { readFileSync } from 'node:fs';
import * as Sentry from '@sentry/node';
import { createServer } from '@/adapters/http.adapter';
import { parseRuntimeConfig } from '@/config/runtime-config';
import { resolveRuntimeEnvironment } from '@/config/runtime-environment';
import {
  createConfiguredCredentialVerifier,
  createJwtAccessTokenIssuer,
} from '@/features/authentication';
import { createTradingRpcMarketData } from '@/features/coin-information';
import { resolveFastifyLoggerOptions } from '@/platform/fastify/logger-options';

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

process.on('uncaughtException', (error) => {
  reportError(error, 'Uncaught exception');
  void gracefulShutdown(1);
});

async function main() {
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
    authentication: {
      credentialVerifier: createConfiguredCredentialVerifier({
        email: config.adminAuthEmail,
        password: config.adminAuthPassword,
        identity: {
          id: 'admin',
          email: config.adminAuthEmail,
          name: 'Administrator',
        },
      }),
      accessTokenIssuer: createJwtAccessTokenIssuer({
        secret: config.jwtSecret,
        ttlSeconds: config.jwtTtlSeconds,
      }),
    },
    tradingMarketData: createTradingRpcMarketData({
      baseUrl: config.tradingRpcGrpcUrl,
      timeoutMs: config.tradingRpcTimeoutMs,
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
        tradingRpcGrpcUrl: config.tradingRpcGrpcUrl,
      },
      'Nest admin RPC service is listening',
    );
}

main().catch((error) => {
  reportError(error, 'Failed to start admin RPC');
  void gracefulShutdown(1);
});
