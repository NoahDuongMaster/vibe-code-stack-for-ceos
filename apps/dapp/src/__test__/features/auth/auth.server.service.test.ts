import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerSession } from '@/features/auth/services/auth.server.service';
import * as session from '@/server/lib/session';

// Factory-based mock — a bare `vi.mock(path)` auto-mock still evaluates the
// real module first, which would run session.ts's real env.configuration.ts
// validation in a test process where the required env vars aren't set.
vi.mock('@/server/lib/session', () => ({ getSessionUser: vi.fn() }));

describe('auth.server.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return isLoggedIn: true with the user when a session user exists', async () => {
    const user = { id: '1', email: 'demo@example.com', name: 'Demo User' };
    vi.mocked(session.getSessionUser).mockResolvedValue(user);

    await expect(getServerSession()).resolves.toEqual({
      isLoggedIn: true,
      user,
    });
  });

  it('should return isLoggedIn: false with no user when there is no session', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue(null);

    await expect(getServerSession()).resolves.toEqual({
      isLoggedIn: false,
      user: undefined,
    });
  });
});
