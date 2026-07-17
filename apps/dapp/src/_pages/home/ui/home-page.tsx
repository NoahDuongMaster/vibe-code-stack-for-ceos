import { MarketDashboard } from '@/_pages/home/ui/market-dashboard';
import { css } from '@/styled-system/css';

const dashboardRootStyle = css({
  minH: '100vh',
  overflow: 'hidden',
  color: '#e8f5f7',
  bgColor: '#071018',
  backgroundImage:
    'linear-gradient(rgba(103, 232, 249, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(103, 232, 249, 0.035) 1px, transparent 1px), radial-gradient(circle at 72% 12%, rgba(167, 139, 250, 0.14), transparent 34rem)',
  backgroundSize: '48px 48px, 48px 48px, auto',
});

export function HomePage() {
  return (
    <main className={dashboardRootStyle}>
      <MarketDashboard />
    </main>
  );
}
