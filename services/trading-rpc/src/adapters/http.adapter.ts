import 'reflect-metadata';
import { cors as connectCors } from '@connectrpc/connect';
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { createRoutes, isOriginAllowed } from '@packages/api-core';
import type { FastifyServerOptions } from 'fastify';
import {
  createTradingServiceRoutes,
  GET_MARKETS,
  type GetMarkets,
  type MarketDataProvider,
  type MarketSnapshotRepository,
} from '@/features/market-data';
import { resolveGrpcProtoPaths } from '@/infra/grpc-protocol';
import { createRequestChildLoggerFactory } from '@/platform/fastify/request-log-bindings';
import { TradingRpcModule } from '@/platform/nest/trading-rpc.module';

export interface TServerOptions {
  /** Validated runtime identity used by health and telemetry adapters. */
  serviceName: string;
  /** Outbound domain port; Nest creates and injects the application use case. */
  marketDataProvider: MarketDataProvider;
  /** Outbound persistence port managed through Nest lifecycle hooks. */
  marketSnapshotRepository: MarketSnapshotRepository;
  /** Allowed CORS origins for browser clients. '*' allows any origin. Defaults to none. */
  corsOrigins?: string[];
  /** Enables HTTP/2 on the Connect listener. Defaults to true. */
  http2?: boolean;
  /** Native Nest gRPC bind address. Defaults to 0.0.0.0:46005. */
  grpcUrl?: string;
  /** Disable only for focused tests that do not exercise native gRPC. */
  enableGrpc?: boolean;
  /** Disable only in tests to avoid installing process signal listeners. */
  enableShutdownHooks?: boolean;
  /** Rejects request bodies larger than this many bytes. Defaults to 5 MB. */
  maxBodyBytes?: number;
  /** Per-request idle timeout in ms. Defaults to 30s. */
  requestTimeoutMs?: number;
  /** Max requests per client per `rateLimitWindowMs`. Defaults to 300. */
  rateLimit?: number;
  /** Rate limit window in ms. Defaults to 60s. */
  rateLimitWindowMs?: number;
  /** Fastify/Pino logger configuration. `false` also disables Nest logs. */
  logger?: FastifyServerOptions['logger'];
}

/**
 * Creates the Nest host without opening a listener. Nest owns modules, DI,
 * controllers, interceptors, lifecycle, and native gRPC. The official Connect
 * plugin is mounted on Nest's underlying Fastify instance so Cloudflare's VPC
 * Fetcher can continue forwarding standard Request/Response traffic.
 */
export async function createServer(
  options: TServerOptions,
): Promise<NestFastifyApplication> {
  const allowedOrigins = options.corsOrigins ?? [];
  const maxBodyBytes = options.maxBodyBytes ?? 5 * 1024 * 1024;
  const fastifyOptions = {
    bodyLimit: maxBodyBytes,
    childLoggerFactory: createRequestChildLoggerFactory(options.serviceName),
    requestIdHeader: 'x-request-id',
    requestTimeout: options.requestTimeoutMs ?? 30_000,
    logger: options.logger ?? true,
  };
  const adapter =
    options.http2 === false
      ? new FastifyAdapter(fastifyOptions)
      : new FastifyAdapter({ ...fastifyOptions, http2: true });
  const app = await NestFactory.create<NestFastifyApplication>(
    TradingRpcModule.register({
      serviceName: options.serviceName,
      marketDataProvider: options.marketDataProvider,
      marketSnapshotRepository: options.marketSnapshotRepository,
    }),
    adapter,
    { logger: options.logger === false ? false : undefined },
  );

  const fastifyInstance = app.getHttpAdapter().getInstance();
  await fastifyInstance.register(fastifyCors, {
    origin: (origin, callback) =>
      callback(null, isOriginAllowed(origin, allowedOrigins)),
    methods: [...connectCors.allowedMethods],
    allowedHeaders: [...connectCors.allowedHeaders],
    exposedHeaders: [...connectCors.exposedHeaders],
    maxAge: 86400,
  });
  await fastifyInstance.register(fastifyRateLimit, {
    max: options.rateLimit ?? 300,
    timeWindow: options.rateLimitWindowMs ?? 60_000,
  });

  const getMarkets = app.get<GetMarkets>(GET_MARKETS);
  await fastifyInstance.register(fastifyConnectPlugin, {
    routes: (router) => {
      createRoutes({ serviceName: options.serviceName, runtime: 'node' })(
        router,
      );
      createTradingServiceRoutes(getMarkets)(router);
    },
    readMaxBytes: maxBodyBytes,
    writeMaxBytes: maxBodyBytes,
  });

  if (options.enableGrpc !== false) {
    app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.GRPC,
        options: {
          url: options.grpcUrl ?? '0.0.0.0:46005',
          package: ['health.v1', 'trading.v1'],
          protoPath: resolveGrpcProtoPaths(),
          gracefulShutdown: true,
          loader: {
            arrays: true,
            defaults: true,
            keepCase: false,
            objects: true,
            oneofs: true,
          },
        },
      },
      { inheritAppConfig: true },
    );
  }

  if (options.enableShutdownHooks !== false) app.enableShutdownHooks();
  return app;
}
