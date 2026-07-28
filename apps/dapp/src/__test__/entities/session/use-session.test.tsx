import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useSession } from '@/entities/session/model/session.query';

const createWrapper = (queryClient: QueryClient) =>
  function TestQueryProvider({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

describe('useSession', () => {
  it('should seed the session query with server-provided initial data', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const initialData = {
      isLoggedIn: true as const,
      user: { id: '1', email: 'demo@example.com', name: 'Demo User' },
    };

    const { result } = renderHook(() => useSession(initialData), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toEqual(initialData);
    expect(queryClient.getQueryData(['auth', 'session'])).toEqual(initialData);
    queryClient.clear();
  });
});
