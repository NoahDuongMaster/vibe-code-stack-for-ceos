import { Open_Sans } from 'next/font/google';
import {
  META_DATA_DEFAULT,
  VIEWPORT_DEFAULT,
  WebsiteJsonLd,
} from '@/_app/metadata';
import { AppProviders } from '@/_app/providers';
import { css, cx } from '@/styled-system/css';
import '@/_app/styles/index.css';

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
        <WebsiteJsonLd />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
};

export default RootLayout;
