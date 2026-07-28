import { Devtools } from '@/bootstrap/providers/devtools';
import { QueryProvider } from '@/bootstrap/providers/query-provider';
import { WebVitals } from '@/bootstrap/providers/web-vitals';
import { AppToaster } from '@/shared/ui/index.client';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WebVitals />
      <QueryProvider>
        {children}
        <Devtools />
        <AppToaster />
      </QueryProvider>
    </>
  );
}
