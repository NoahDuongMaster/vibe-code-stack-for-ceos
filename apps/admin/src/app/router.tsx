import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '@/features/auth';
import { ROUTES } from '@/shared/constants/routes.constant';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import { RouteError } from './error-boundary';

// Route-level code splitting — each page (and the authenticated shell itself)
// ships as its own chunk. AppLayout in particular pulls in @ark-ui/react,
// lucide-react, and nuqs — none of which an unauthenticated visitor on
// /login should ever download. Because RequireAuth returns <Navigate>
// without rendering its children when unauthenticated, this lazy chunk is
// never even requested for that visitor.
const AppLayout = lazy(() =>
  import('./layout').then((m) => ({ default: m.AppLayout })),
);
const LoginPage = lazy(() =>
  import('./routes/login.page').then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('./routes/dashboard.page').then((m) => ({
    default: m.DashboardPage,
  })),
);
const UsersPage = lazy(() =>
  import('./routes/users.page').then((m) => ({ default: m.UsersPage })),
);
const NotFoundPage = lazy(() =>
  import('./routes/not-found.page').then((m) => ({
    default: m.NotFoundPage,
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
    element: <RequireAuth>{withSuspense(<AppLayout />)}</RequireAuth>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'users', element: withSuspense(<UsersPage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
]);
