import type { ReactNode } from 'react';
import { AppToaster } from '@/shared/components/ui/toaster';
import { QueryProvider } from '@/shared/stores/query-provider';

/** Top-level providers that must wrap the whole app (above the router). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <AppToaster />
    </QueryProvider>
  );
}
