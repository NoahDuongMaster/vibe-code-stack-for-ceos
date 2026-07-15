import { fileURLToPath } from 'node:url';
import {
  checkBackendArchitecture,
  printArchitectureResult,
} from '../../../scripts/check-backend-architecture.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../src', import.meta.url));
const root = process.argv[2] ?? DEFAULT_ROOT;

const violations = await checkBackendArchitecture({
  root,
  forbiddenFeatureOuterRoots: ['adapters', 'runtime'],
  forbiddenRootRuntimeModules: ['adapters', 'index', 'runtime'],
  sharedForbiddenPackages: ['@connectrpc/connect', '@packages/protocol'],
});

printArchitectureResult({ label: 'API Core', violations });
