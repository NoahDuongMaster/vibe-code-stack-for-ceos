import { createConsola, type LogObject } from 'consola';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = createConsola({
  level: isProduction ? 3 : 5,
  formatOptions: {
    date: isProduction,
    columns: isProduction ? 0 : 80,
    compact: isProduction,
  },
  reporters: isProduction
    ? [
        {
          log(logObj: LogObject) {
            const entry = {
              level: logObj.type,
              message: logObj.args?.join(' ') ?? '',
              timestamp: new Date().toISOString(),
              ...(logObj.tag ? { tag: logObj.tag } : {}),
            };
            // biome-ignore lint/suspicious/noConsole: structured log output
            console.log(JSON.stringify(entry));
          },
        },
      ]
    : undefined,
});

export const createTaggedLogger = (tag: string) => logger.withTag(tag);
