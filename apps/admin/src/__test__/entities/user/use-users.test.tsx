import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USERS_QUERY_KEY, useUsers } from '@/entities/user/model/use-users';

const { getUsersMock } = vi.hoisted(() => ({ getUsersMock: vi.fn() }));

vi.mock('@/entities/user/api/user.api', () => ({
  getUsers: getUsersMock,
}));

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query users through the entity API', async () => {
    const users = [
      {
        id: 'user-1',
        name: 'Ada',
        email: 'ada@example.com',
        role: 'admin' as const,
        createdAt: '2026-07-28T00:00:00.000Z',
      },
    ];
    getUsersMock.mockResolvedValue(users);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(users);
    expect(getUsersMock).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(USERS_QUERY_KEY)).toEqual(users);
  });
});
