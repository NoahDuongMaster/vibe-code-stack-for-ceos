import type { ReactNode } from 'react';
import { AppToaster } from '@/shared/ui';
import { QueryProvider } from './query-provider';
import { SessionEvents } from './session-events';

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
