import { useUsers } from '@/entities/user';
import { HealthStatus } from '@/screens/dashboard/ui/health-status';
import { MarketDashboard } from '@/screens/dashboard/ui/market-dashboard';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

export function DashboardPage() {
  const { data: users, isError: isUsersError } = useUsers();
  const userSummary = isUsersError
    ? 'Team accounts unavailable'
    : users
      ? `${users.length} team accounts`
      : 'Loading team accounts…';

  return (
    <main className={flex({ direction: 'column', gap: '7' })}>
      <div
        className={flex({
          align: { base: 'start', md: 'center' },
          direction: { base: 'column', md: 'row' },
          gap: '4',
          justify: 'space-between',
        })}
      >
        <div>
          <p
            className={css({
              color: 'muted.foreground',
              fontSize: 'xs',
              fontWeight: 'semibold',
              letterSpacing: 'wider',
              textTransform: 'uppercase',
            })}
          >
            Operations console
          </p>
          <h1
            className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              letterSpacing: 'tight',
              mt: '1',
            })}
          >
            Market dashboard
          </h1>
          <p
            className={css({
              color: 'muted.foreground',
              fontSize: 'sm',
              mt: '1',
            })}
          >
            Live coin information routed securely through the admin service.
          </p>
        </div>
        <div
          className={flex({
            direction: 'column',
            align: { base: 'start', md: 'end' },
            gap: '2',
          })}
        >
          <HealthStatus />
          <span className={css({ color: 'muted.foreground', fontSize: 'xs' })}>
            {userSummary}
          </span>
        </div>
      </div>

      <MarketDashboard />
    </main>
  );
}
