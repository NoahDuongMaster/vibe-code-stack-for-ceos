import type { FastifyServerOptions } from 'fastify';

type TFastifyChildLoggerFactory = NonNullable<
  FastifyServerOptions['childLoggerFactory']
>;

const CONNECT_RPC_PATH =
  /^\/(?<rpcService>[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+)\/(?<rpcMethod>[A-Za-z_][\w]*)$/;

export const createRequestChildLoggerFactory =
  (serviceName: string): TFastifyChildLoggerFactory =>
  (logger, bindings, childLoggerOptions, rawRequest) => {
    const httpPath = new URL(rawRequest.url ?? '/', 'http://localhost')
      .pathname;
    const rpcPath = CONNECT_RPC_PATH.exec(httpPath)?.groups;
    const operation =
      rpcPath?.rpcService && rpcPath.rpcMethod
        ? {
            protocol: 'connect',
            rpcService: rpcPath.rpcService,
            rpcMethod: rpcPath.rpcMethod,
          }
        : {
            protocol: 'http',
            httpMethod: rawRequest.method ?? 'UNKNOWN',
            httpPath,
          };

    return logger.child(
      { ...bindings, serviceName, runtime: 'node', ...operation },
      childLoggerOptions,
    );
  };
