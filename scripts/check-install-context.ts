import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPLACEMENT_MESSAGE = 'Run `mise setup` instead of `pnpm install`.';

export const validateInstallContext = (
  taskName: string | undefined,
): string[] => (taskName === 'setup' ? [] : [REPLACEMENT_MESSAGE]);

const mainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === mainModule) {
  const errors = validateInstallContext(process.env.MISE_TASK_NAME);

  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
  }
}
