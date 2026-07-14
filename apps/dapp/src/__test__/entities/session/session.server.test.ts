import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicSession } from '@/entities/session/index.server';

vi.mock('@/shared/config', () => ({
  env: { server: { SESSION_SECRET: 'test-session-secret-min-32-chars!!' } },
}));
vi.mock('iron-session', () => ({ getIronSession: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

describe('getPublicSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
  });

  it('should return only the public user fields when a server session contains an access token', async () => {
    const user = {
      id: '1',
      email: 'demo@example.com',
      name: 'Demo User',
      avatarUrl: 'https://example.com/avatar.png',
      accessToken: 'server-secret-token',
    };
    vi.mocked(getIronSession).mockResolvedValue({
      isLoggedIn: true,
      user,
    } as never);

    const publicSession = await getPublicSession();

    expect(publicSession).toEqual({
      isLoggedIn: true,
      user: {
        id: '1',
        email: 'demo@example.com',
        name: 'Demo User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    expect(publicSession.user).not.toHaveProperty('accessToken');
  });

  it('should return isLoggedIn: false with no user when there is no session', async () => {
    vi.mocked(getIronSession).mockResolvedValue({ isLoggedIn: false } as never);

    await expect(getPublicSession()).resolves.toEqual({ isLoggedIn: false });
  });
});
