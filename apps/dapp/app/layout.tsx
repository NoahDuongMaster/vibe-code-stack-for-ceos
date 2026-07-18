import { IBM_Plex_Mono, Manrope, Unbounded } from 'next/font/google';
import {
  META_DATA_DEFAULT,
  VIEWPORT_DEFAULT,
  WebsiteJsonLd,
} from '@/_app/metadata';
import { AppProviders } from '@/_app/providers';
import { css, cx } from '@/styled-system/css';
import '@/_app/styles/index.css';

const fontDisplay = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '800'],
});

const fontSans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata = META_DATA_DEFAULT;
export const viewport = VIEWPORT_DEFAULT;

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body
        className={cx(
          fontSans.className,
          fontDisplay.variable,
          fontSans.variable,
          fontMono.variable,
          css({
            minH: '100vh',
            fontFamily:
              'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
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
