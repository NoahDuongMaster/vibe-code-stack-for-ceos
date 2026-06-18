import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useLogout, useSession } from '@/shared/hooks/use-session';
import { server } from '../mocks/server';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useSession', () => {
  it('returns isLoggedIn: false when not authenticated', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ isLoggedIn: false })),
    );

    const { result } = renderHook(() => useSession(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ isLoggedIn: false });
  });

  it('returns session data when authenticated', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          isLoggedIn: true,
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
        }),
      ),
    );

    const { result } = renderHook(() => useSession(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.isLoggedIn).toBe(true);
  });

  it('falls back to isLoggedIn: false on non-ok server response', async () => {
    server.use(
      http.get('/api/auth/me', () => new HttpResponse(null, { status: 500 })),
    );

    const { result } = renderHook(() => useSession(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual({ isLoggedIn: false });
  });

  it('caches result and does not re-fetch within staleTime', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/auth/me', () => {
        callCount++;
        return HttpResponse.json({ isLoggedIn: true });
      }),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result: r1 } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { result: r2 } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    expect(callCount).toBe(1);
  });
});

describe('useLogout', () => {
  it('calls /api/auth/logout and sets session to isLoggedIn: false', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          isLoggedIn: true,
          user: { id: '1', email: 'a@b.com' },
        }),
      ),
      http.post('/api/auth/logout', () => HttpResponse.json({ success: true })),
    );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useLogout(), { wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const session = client.getQueryData<{ isLoggedIn: boolean }>(['session']);
    expect(session?.isLoggedIn).toBe(false);
  });
});
