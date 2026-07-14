import { cors as connectCors } from '@connectrpc/connect';
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { createRoutes, isOriginAllowed } from '@packages/api-core';
import { fastify } from 'fastify';
import { createTradingServiceRoutes } from '@/adapters/connect/trading-service.routes';
import type { GetCryptoMarkets } from '@/application/get-crypto-markets/get-crypto-markets.port';

export interface TServerOptions {
  /** Application input port, assembled by the Node composition root. */
  getCryptoMarkets: GetCryptoMarkets;
  /** Allowed CORS origins for browser clients. '*' allows any origin. Defaults to none. */
  corsOrigins?: string[];
  /** Enables native gRPC over HTTP/2. Defaults to true. */
  http2?: boolean;
  /** Rejects request bodies larger than this many bytes. Defaults to 5 MB. */
  maxBodyBytes?: number;
  /** Per-request idle timeout in ms. Defaults to 30s. */
  requestTimeoutMs?: number;
  /** Max requests per client per `rateLimitWindowMs`. Defaults to 300. */
  rateLimit?: number;
  /** Rate limit window in ms. Defaults to 60s. */
  rateLimitWindowMs?: number;
  /** Pino logger — disable in tests. Defaults to true. */
  logger?: boolean;
}

/**
 * INBOUND ADAPTER — a Fastify (HTTP/2) server hosting shared ApiService routes
 * plus this microservice's TradingService routes via the official Connect
 * plugin. It serves Connect + gRPC + gRPC-Web with all streaming types (gRPC
 * needs HTTP/2 + trailers, which Fastify's http2 server provides). Cross-cutting
 * runtime concerns are Fastify plugins: CORS, rate limiting, body-size cap,
 * structured logging, and a fast `/healthz`. It translates Fastify ⇄ Connect;
 * its application use case. Async factory — builds and readies the app but
 * does NOT call `.listen()`.
 */
export async function createServer(options: TServerOptions) {
  const allowedOrigins = options.corsOrigins ?? [];
  const maxBodyBytes = options.maxBodyBytes ?? 5 * 1024 * 1024;

  const fastifyOptions = {
    bodyLimit: maxBodyBytes,
    requestTimeout: options.requestTimeoutMs ?? 30_000,
    logger: options.logger ?? true,
  };
  // Fastify's overloads require the literal `http2: true`, not a dynamic
  // boolean. Keep each typed server branch intact while registering the same
  // Fastify plugins, rather than creating an uncallable HTTP/1.1 | HTTP/2 union.
  const rateLimitOptions = {
    max: options.rateLimit ?? 300,
    timeWindow: options.rateLimitWindowMs ?? 60_000,
  };
  const connectOptions = {
    routes: (router: Parameters<ReturnType<typeof createRoutes>>[0]) => {
      createRoutes({ serviceName: 'api-node', runtime: 'node' })(router);
      createTradingServiceRoutes(options.getCryptoMarkets)(router);
    },
    // The real body-size enforcement point for streaming/chunked requests; the
    // Fastify bodyLimit above is a fast-fail for requests with a Content-Length.
    readMaxBytes: maxBodyBytes,
    writeMaxBytes: maxBodyBytes,
  };

  if (options.http2 === false) {
    const app = fastify(fastifyOptions);
    await app.register(fastifyCors, {
      origin: (origin, cb) => cb(null, isOriginAllowed(origin, allowedOrigins)),
      methods: [...connectCors.allowedMethods],
      allowedHeaders: [...connectCors.allowedHeaders],
      exposedHeaders: [...connectCors.exposedHeaders],
      maxAge: 86400,
    });
    await app.register(fastifyRateLimit, rateLimitOptions);
    app.get('/healthz', { config: { rateLimit: false } }, () => ({
      status: 'ok',
    }));
    await app.register(fastifyConnectPlugin, connectOptions);
    await app.ready();
    return app;
  }

  const app = fastify({ ...fastifyOptions, http2: true });
  await app.register(fastifyCors, {
    origin: (origin, cb) => cb(null, isOriginAllowed(origin, allowedOrigins)),
    methods: [...connectCors.allowedMethods],
    allowedHeaders: [...connectCors.allowedHeaders],
    exposedHeaders: [...connectCors.exposedHeaders],
    maxAge: 86400,
  });
  await app.register(fastifyRateLimit, rateLimitOptions);
  app.get('/healthz', { config: { rateLimit: false } }, () => ({
    status: 'ok',
  }));
  await app.register(fastifyConnectPlugin, connectOptions);
  await app.ready();
  return app;
}
