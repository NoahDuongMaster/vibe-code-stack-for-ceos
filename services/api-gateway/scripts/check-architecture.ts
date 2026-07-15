import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import {
  checkBackendArchitecture,
  printArchitectureResult,
} from '@repo/architecture-checker';

const DEFAULT_ROOT = fileURLToPath(new URL('../src', import.meta.url));

export const checkGatewayArchitecture = (root = DEFAULT_ROOT) =>
  checkBackendArchitecture({
    root,
    requireAbsoluteImports: true,
    forbiddenRootRuntimeModules: ['adapters', 'config', 'index'],
  });

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const violations = await checkGatewayArchitecture(process.argv[2]);
  printArchitectureResult({ label: 'Gateway', violations });
}
