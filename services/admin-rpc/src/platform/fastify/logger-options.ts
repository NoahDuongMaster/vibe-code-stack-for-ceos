import type { FastifyServerOptions } from 'fastify';

const DEVELOPMENT_LOGGER = {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:HH:MM:ss.l',
    },
  },
} satisfies FastifyServerOptions['logger'];

export const resolveFastifyLoggerOptions = (
  nodeEnv: string,
): FastifyServerOptions['logger'] =>
  nodeEnv === 'development' ? DEVELOPMENT_LOGGER : true;
