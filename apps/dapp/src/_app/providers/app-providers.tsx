import { Devtools } from '@/_app/providers/devtools';
import { QueryProvider } from '@/_app/providers/query-provider';
import { WebVitals } from '@/_app/providers/web-vitals';
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
