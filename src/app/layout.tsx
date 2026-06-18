import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import {
  ColorModeProvider,
  colorModeScript,
} from '@/features/color-mode';
import { Devtools } from '@/shared/components/providers/devtools';
import WebVitals from '@/shared/components/providers/web-vitals';
import { META_DATA_DEFAULT } from '@/shared/constants/seo.constant';

import '@/styles/global.style.css';

import { Open_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import { cn } from '@/shared/utils/tailwind.helper';

import ReactQueryStore from '@/shared/stores/react-query.store';

const fontSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

export const metadata = META_DATA_DEFAULT;

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before React hydrates — prevents flash of wrong color mode */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional inline script for color mode initialization */}
        <script dangerouslySetInnerHTML={{ __html: colorModeScript }} />
      </head>
      <body
        className={cn(
          'min-h-screen font-sans antialiased bg-background',
          fontSans.variable,
        )}
      >
        <WebVitals />
        <ReactQueryStore>
          <ColorModeProvider>{children}</ColorModeProvider>
          <Devtools />
          <Toaster richColors position="top-right" />
        </ReactQueryStore>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
};

export default RootLayout;
