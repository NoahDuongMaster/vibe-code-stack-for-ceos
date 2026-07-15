import type { FastifyServerOptions } from 'fastify';

type TFastifyChildLoggerFactory = NonNullable<
  FastifyServerOptions['childLoggerFactory']
>;

const CONNECT_RPC_PATH =
  /^\/(?<rpcService>[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+)\/(?<rpcMethod>[A-Za-z_][\w]*)$/;

interface TRequestLogBase {
  serviceName: string;
  runtime: 'node';
}

interface TConnectRequestLogBindings extends TRequestLogBase {
  protocol: 'connect';
  rpcService: string;
  rpcMethod: string;
}

interface THttpRequestLogBindings extends TRequestLogBase {
  protocol: 'http';
  httpMethod: string;
  httpPath: string;
}

export type TRequestLogBindings =
  | TConnectRequestLogBindings
  | THttpRequestLogBindings;

/**
 * Derives low-cardinality request context for access logs. Payloads and query
 * values are deliberately excluded so logs cannot leak RPC input/output data.
 */
export const createRequestLogBindings = (
  serviceName: string,
  method: string | undefined,
  rawUrl: string | undefined,
): TRequestLogBindings => {
  const httpPath = new URL(rawUrl ?? '/', 'http://localhost').pathname;
  const rpcPath = CONNECT_RPC_PATH.exec(httpPath)?.groups;

  if (rpcPath?.rpcService && rpcPath.rpcMethod) {
    return {
      serviceName,
      runtime: 'node',
      protocol: 'connect',
      rpcService: rpcPath.rpcService,
      rpcMethod: rpcPath.rpcMethod,
    };
  }

  return {
    serviceName,
    runtime: 'node',
    protocol: 'http',
    httpMethod: method ?? 'UNKNOWN',
    httpPath,
  };
};

/** Adds request context once to Fastify's Pino child logger. */
export const createRequestChildLoggerFactory =
  (serviceName: string): TFastifyChildLoggerFactory =>
  (logger, bindings, childLoggerOptions, rawRequest) =>
    logger.child(
      {
        ...bindings,
        ...createRequestLogBindings(
          serviceName,
          rawRequest.method,
          rawRequest.url,
        ),
      },
      childLoggerOptions,
    );
