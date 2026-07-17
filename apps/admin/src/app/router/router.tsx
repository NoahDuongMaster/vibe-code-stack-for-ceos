import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/app/router/require-auth';
import { RouteError } from '@/app/router/route-error';
import { ROUTES } from '@/shared/routes';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

const AppShell = lazy(() =>
  import('@/widgets/app-shell').then((module) => ({
    default: module.AppShell,
  })),
);
const LoginPage = lazy(() =>
  import('@/pages/login').then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard').then((module) => ({
    default: module.DashboardPage,
  })),
);
const UsersPage = lazy(() =>
  import('@/pages/users').then((module) => ({ default: module.UsersPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/not-found').then((module) => ({
    default: module.NotFoundPage,
  })),
);

const routeFallbackCss = flex({
  align: 'center',
  justify: 'center',
  minH: '100vh',
});

function RouteFallback() {
  return (
    <div className={routeFallbackCss}>
      <span className={css({ fontSize: 'sm', color: 'muted.foreground' })}>
        Loading…
      </span>
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: withSuspense(<LoginPage />),
    errorElement: <RouteError />,
  },
  {
    path: ROUTES.DASHBOARD,
    element: <RequireAuth>{withSuspense(<AppShell />)}</RequireAuth>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'users', element: withSuspense(<UsersPage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
]);
