import './styles/global.css';
import { useQueryClient } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { useAuthStore } from '@/features/auth';
import { AppProviders } from '@/shared/components/providers/app-providers';
import { ROUTES } from '@/shared/constants/routes.constant';
import { onUnauthenticated } from '@/shared/lib/auth-events';
import { initSentry } from '@/shared/lib/sentry';

initSentry();

// Registered once at the app root — the only place allowed to import both
// `@/app/router` (for `navigate`) and `@/features/auth` (for `signOut`).
// `shared/lib/api-client.ts`'s interceptor emits this event on any 401.
function App() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onUnauthenticated(() => {
        useAuthStore.getState().signOut();
        queryClient.clear();
        router.navigate(ROUTES.LOGIN);
      }),
    [queryClient],
  );

  return <RouterProvider router={router} />;
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}
