export type TReadRuntimeFile = (path: string) => string;

const FILE_BACKED_VALUES = [
  ['DATABASE_URL_FILE', 'DATABASE_URL'],
  ['COINGECKO_API_KEY_FILE', 'COINGECKO_API_KEY'],
  ['SENTRY_DSN_FILE', 'SENTRY_DSN'],
] as const;

export const resolveRuntimeEnvironment = (
  environment: Record<string, string | undefined>,
  readRuntimeFile: TReadRuntimeFile,
): Record<string, string | undefined> => {
  let resolved = environment;

  for (const [fileKey, valueKey] of FILE_BACKED_VALUES) {
    const path = environment[fileKey]?.trim();
    if (!path) continue;
    if (resolved === environment) resolved = { ...environment };
    resolved[valueKey] = readRuntimeFile(path).trim();
  }

  return resolved;
};
