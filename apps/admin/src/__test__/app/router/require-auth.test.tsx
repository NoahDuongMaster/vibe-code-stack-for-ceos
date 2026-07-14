import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { RequireAuth } from '@/app/router/require-auth';
import { useSessionStore } from '@/entities/session';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => useSessionStore.getState().signOut());

  it('should redirect to the login route when unauthenticated', () => {
    renderAt('/dashboard');

    expect(screen.getByText('Login page')).toBeDefined();
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('should render children when authenticated', () => {
    useSessionStore.getState().signIn({
      token: 'demo-token',
      user: { id: '1', email: 'admin@example.com', name: 'admin' },
    });

    renderAt('/dashboard');

    expect(screen.getByText('Protected content')).toBeDefined();
    expect(screen.queryByText('Login page')).toBeNull();
  });
});
