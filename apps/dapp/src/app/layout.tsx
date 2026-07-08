import { Devtools } from '@/shared/components/providers/devtools';
import { WebVitals } from '@/shared/components/providers/web-vitals';
import { WebsiteJsonLd } from '@/shared/components/seo/json-ld';
import {
  META_DATA_DEFAULT,
  VIEWPORT_DEFAULT,
} from '@/shared/constants/seo.constant';

import '@/styles/global.style.css';

import { Open_Sans } from 'next/font/google';
import { AppToaster } from '@/shared/components/ui/toaster';
import { ReactQueryStore } from '@/shared/stores/react-query.store';
import { css, cx } from '@/styled-system/css';

const fontSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

export const metadata = META_DATA_DEFAULT;
export const viewport = VIEWPORT_DEFAULT;

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body
        className={cx(
          fontSans.variable,
          css({
            minH: '100vh',
            fontFamily: 'sans',
            fontSmoothing: 'antialiased',
            bg: 'background',
          }),
        )}
      >
        <WebVitals />
        <WebsiteJsonLd />
        <ReactQueryStore>
          {children}
          <Devtools />
          <AppToaster />
        </ReactQueryStore>
      </body>
    </html>
  );
};

export default RootLayout;
