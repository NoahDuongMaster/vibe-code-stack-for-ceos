import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/entities/session';

describe('useSessionStore', () => {
  beforeEach(() => useSessionStore.getState().signOut());

  it('should start unauthenticated', () => {
    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('should authenticate on signIn and clear on signOut', () => {
    useSessionStore.getState().signIn({
      token: 'demo-token',
      user: { id: '1', email: 'admin@example.com', name: 'admin' },
    });

    expect(useSessionStore.getState().isAuthenticated).toBe(true);
    expect(useSessionStore.getState().user?.email).toBe('admin@example.com');

    useSessionStore.getState().signOut();

    expect(useSessionStore.getState().isAuthenticated).toBe(false);
    expect(useSessionStore.getState().token).toBeNull();
  });
});
