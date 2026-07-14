import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logoutAction } from '@/_pages/account/api/logout.action';
import { getMutableSession } from '@/entities/session/index.server';

vi.mock('@/entities/session/index.server', () => ({
  getMutableSession: vi.fn(),
}));

describe('logoutAction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should destroy the session and report success', async () => {
    const destroy = vi.fn();
    vi.mocked(getMutableSession).mockResolvedValue({
      destroy,
    } as unknown as Awaited<ReturnType<typeof getMutableSession>>);

    const result = await logoutAction();

    expect(destroy).toHaveBeenCalledOnce();
    expect(result?.data).toEqual({ success: true });
  });
});
