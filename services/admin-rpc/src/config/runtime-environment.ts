export type TReadRuntimeFile = (path: string) => string;

const FILE_BACKED_VALUES = [
  ['ADMIN_AUTH_EMAIL_FILE', 'ADMIN_AUTH_EMAIL'],
  ['ADMIN_AUTH_PASSWORD_FILE', 'ADMIN_AUTH_PASSWORD'],
  ['JWT_SECRET_FILE', 'JWT_SECRET'],
  ['SENTRY_DSN_FILE', 'SENTRY_DSN'],
] as const;

/**
 * Resolves Docker/Kubernetes-style file-backed secrets at the composition
 * boundary. Direct environment values remain available for local development.
 */
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
