import type { ReactNode } from 'react';
import { QueryProvider } from '@/bootstrap/providers/query-provider';
import { SessionEvents } from '@/bootstrap/providers/session-events';
import { AppToaster } from '@/shared/ui';

/** Top-level providers that must wrap the whole app (above the router). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SessionEvents />
      {children}
      <AppToaster />
    </QueryProvider>
  );
}
