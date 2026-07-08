import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logoutAction } from '@/features/auth/actions/auth.action';
import * as session from '@/server/lib/session';

// A factory-based mock avoids ever evaluating the real module — auto-mocking
// (`vi.mock(path)` with no factory) still imports the real file first to
// infer its shape, which would run session.ts's `import 'server-only'` and
// its `env.configuration.ts` env validation for real in a test process where
// the required env vars aren't set.
vi.mock('@/server/lib/session', () => ({ getSession: vi.fn() }));

describe('logoutAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should destroy the session and report success', async () => {
    const destroy = vi.fn();
    vi.mocked(session.getSession).mockResolvedValue({
      destroy,
    } as unknown as Awaited<ReturnType<typeof session.getSession>>);

    const result = await logoutAction();

    expect(destroy).toHaveBeenCalledOnce();
    expect(result?.data).toEqual({ success: true });
  });
});
