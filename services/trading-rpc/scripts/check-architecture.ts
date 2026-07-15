import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkBackendArchitecture,
  printArchitectureResult,
} from '@repo/architecture-checker';

const DEFAULT_ROOT = fileURLToPath(new URL('../src', import.meta.url));

export const checkTradingRpcArchitecture = (root = DEFAULT_ROOT) =>
  checkBackendArchitecture({
    root,
    requireAbsoluteImports: true,
    forbiddenRootRuntimeModules: [
      'adapters/http.adapter',
      'config',
      'index',
      'infra/rpc-transport',
      'platform',
    ],
  });

const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const violations = await checkTradingRpcArchitecture(process.argv[2]);
  printArchitectureResult({ label: 'Trading RPC', violations });
}
