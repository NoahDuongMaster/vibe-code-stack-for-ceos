import { AppToaster } from '@/shared/ui/index.client';
import { Devtools } from './devtools';
import { QueryProvider } from './query-provider';
import { WebVitals } from './web-vitals';

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
