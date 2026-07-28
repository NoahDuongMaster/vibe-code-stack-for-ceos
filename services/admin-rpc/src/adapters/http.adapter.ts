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
  createAuthServiceRoutes,
  LOGIN,
  type Login,
  type TAuthenticationModuleOptions,
} from '@/features/authentication';
import {
  createAdminServiceRoutes,
  GET_MARKETS,
  type GetMarkets,
  type TradingMarketData,
} from '@/features/coin-information';
import {
  resolveGrpcProtoPaths,
  resolveGrpcProtoRoot,
} from '@/infra/grpc-protocol';
import { createRequestChildLoggerFactory } from '@/platform/fastify/request-log-bindings';
import { AdminRpcModule } from '@/platform/nest/admin-rpc.module';

export interface TServerOptions {
  serviceName: string;
  tradingMarketData: TradingMarketData;
  authentication: TAuthenticationModuleOptions;
  corsOrigins?: string[];
  http2?: boolean;
  grpcUrl?: string;
  enableGrpc?: boolean;
  enableShutdownHooks?: boolean;
  maxBodyBytes?: number;
  requestTimeoutMs?: number;
  rateLimit?: number;
  rateLimitWindowMs?: number;
  logger?: FastifyServerOptions['logger'];
}

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
    AdminRpcModule.register({
      serviceName: options.serviceName,
      tradingMarketData: options.tradingMarketData,
      ...options.authentication,
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
  const login = app.get<Login>(LOGIN);
  await fastifyInstance.register(fastifyConnectPlugin, {
    routes: (router) => {
      createRoutes({ serviceName: options.serviceName, runtime: 'node' })(
        router,
      );
      createAuthServiceRoutes(login)(router);
      createAdminServiceRoutes(getMarkets)(router);
    },
    readMaxBytes: maxBodyBytes,
    writeMaxBytes: maxBodyBytes,
  });

  if (options.enableGrpc !== false) {
    app.connectMicroservice<MicroserviceOptions>(
      {
        transport: Transport.GRPC,
        options: {
          url: options.grpcUrl ?? '0.0.0.0:46007',
          package: ['health.v1', 'auth.v1', 'admin.v1'],
          protoPath: resolveGrpcProtoPaths(),
          gracefulShutdown: true,
          loader: {
            arrays: true,
            defaults: true,
            includeDirs: [resolveGrpcProtoRoot()],
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
