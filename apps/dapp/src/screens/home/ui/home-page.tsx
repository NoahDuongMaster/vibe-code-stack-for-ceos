import { MarketDashboard } from '@/screens/home/ui/market-dashboard';
import { css } from '@/styled-system/css';

const dashboardRootStyle = css({
  position: 'relative',
  minH: '100vh',
  overflow: 'clip',
  color: 'bone',
  bgColor: 'void',
  backgroundImage:
    'radial-gradient(circle at 88% -8%, rgba(139, 92, 246, 0.26), transparent 34rem)',
});

const coordinateMarkStyle = css({
  position: 'absolute',
  zIndex: 0,
  w: '7',
  h: '7',
  pointerEvents: 'none',
  opacity: 0.28,
  _before: {
    content: '""',
    position: 'absolute',
    insetInlineStart: 0,
    top: '50%',
    w: 'full',
    h: '1px',
    bgColor: 'bone',
  },
  _after: {
    content: '""',
    position: 'absolute',
    insetInlineStart: '50%',
    top: 0,
    w: '1px',
    h: 'full',
    bgColor: 'bone',
  },
});

export function HomePage() {
  return (
    <main className={dashboardRootStyle}>
      <span
        aria-hidden="true"
        className={coordinateMarkStyle}
        style={{ left: '1.5rem', top: '7rem' }}
      />
      <span
        aria-hidden="true"
        className={coordinateMarkStyle}
        style={{ right: '2rem', top: '46%' }}
      />
      <span
        aria-hidden="true"
        className={coordinateMarkStyle}
        style={{ bottom: '6rem', left: '8%' }}
      />
      <MarketDashboard />
    </main>
  );
}
