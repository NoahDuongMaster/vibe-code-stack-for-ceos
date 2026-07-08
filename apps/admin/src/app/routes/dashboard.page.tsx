import { HealthStatus } from '@/features/health';
import { useUsers } from '@/features/users';
import { css } from '@/styled-system/css';
import { flex, grid } from '@/styled-system/patterns';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className={css({
        p: '5',
        rounded: 'xl',
        borderWidth: '1px',
        borderColor: 'border',
        bg: 'card',
      })}
    >
      <div className={css({ fontSize: 'sm', color: 'muted.foreground' })}>
        {label}
      </div>
      <div className={css({ fontSize: '3xl', fontWeight: 'bold', mt: '1' })}>
        {value}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data: users = [] } = useUsers();
  const admins = users.filter((u) => u.role === 'admin').length;

  return (
    <div className={flex({ direction: 'column', gap: '6' })}>
      <div
        className={flex({
          justify: 'space-between',
          align: 'center',
          wrap: 'wrap',
          gap: '4',
        })}
      >
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
          Dashboard
        </h1>
        <HealthStatus />
      </div>

      <div className={grid({ columns: { base: 1, sm: 3 }, gap: '4' })}>
        <StatCard label="Total users" value={users.length} />
        <StatCard label="Admins" value={admins} />
        <StatCard label="Members + viewers" value={users.length - admins} />
      </div>
    </div>
  );
}
