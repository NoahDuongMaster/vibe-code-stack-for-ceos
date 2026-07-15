export type TReadRuntimeFile = (path: string) => string;

export const resolveRuntimeEnvironment = (
  environment: Record<string, string | undefined>,
  readRuntimeFile: TReadRuntimeFile,
): Record<string, string | undefined> => {
  const databaseUrlFile = environment.DATABASE_URL_FILE?.trim();
  if (!databaseUrlFile) return environment;

  return {
    ...environment,
    DATABASE_URL: readRuntimeFile(databaseUrlFile).trim(),
  };
};
