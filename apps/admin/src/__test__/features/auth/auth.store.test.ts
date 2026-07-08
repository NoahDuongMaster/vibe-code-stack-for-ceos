import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/features/auth';

describe('useAuthStore', () => {
  beforeEach(() => useAuthStore.getState().signOut());

  it('should start unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('should authenticate on signIn and clear on signOut', () => {
    useAuthStore.getState().signIn({
      token: 'demo-token',
      user: { id: '1', email: 'admin@example.com', name: 'admin' },
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('admin@example.com');

    useAuthStore.getState().signOut();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
