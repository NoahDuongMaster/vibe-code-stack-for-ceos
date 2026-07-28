import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/entities/session/model/session.store';
import { useSession } from '@/entities/session/model/use-session';

describe('useSession', () => {
  beforeEach(() => useSessionStore.getState().signOut());

  it('should expose the current user, authentication state, and sign-out action', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      useSessionStore.getState().signIn({
        token: 'session-token',
        user: { id: 'user-1', email: 'ada@example.com', name: 'Ada' },
      });
    });

    expect(result.current.user?.email).toBe('ada@example.com');
    expect(result.current.isAuthenticated).toBe(true);

    act(() => result.current.signOut());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
