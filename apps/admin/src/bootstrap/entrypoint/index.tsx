import '@/bootstrap/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AppProviders } from '@/bootstrap/providers';
import { router } from '@/bootstrap/router';
import { initSentry } from '@/shared/lib/sentry';

initSentry();

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}
