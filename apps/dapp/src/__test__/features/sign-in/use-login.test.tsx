import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '@/features/sign-in/api/login.api';
import { useLogin } from '@/features/sign-in/model/use-login';

vi.mock('@/features/sign-in/api/login.api', () => ({ login: vi.fn() }));

const createWrapper = (queryClient: QueryClient) =>
  function TestQueryProvider({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

describe('useLogin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should call the login API and invalidate the session query on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(login).mockResolvedValue(undefined);
    const input = { email: 'demo@example.com', password: 'secret' };
    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync(input));

    expect(login).toHaveBeenCalledOnce();
    expect(login).toHaveBeenCalledWith(input, expect.any(Object));
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['auth', 'session'],
    });
  });
});
