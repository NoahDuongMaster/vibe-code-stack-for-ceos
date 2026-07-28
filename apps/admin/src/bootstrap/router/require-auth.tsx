import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSessionStore } from '@/entities/session';
import { ROUTES } from '@/shared/routes';

/** Route guard — redirects unauthenticated users to the login page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location.pathname }} replace />
    );
  }

  return <>{children}</>;
}
