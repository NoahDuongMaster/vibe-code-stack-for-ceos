import { vi } from 'vitest';

// `server-only`'s default export unconditionally throws (it only no-ops
// under the `react-server` resolution condition, which Vitest doesn't set).
// Any test that imports — or auto-mocks without a factory, which still
// evaluates the real module first — a module in the `server/lib/**` chain
// hits this. Stub it globally so those tests don't have to do it one by one.
vi.mock('server-only', () => ({}));
