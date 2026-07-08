import { UserForm, UsersTable } from '@/features/users';
import { css } from '@/styled-system/css';
import { flex, grid } from '@/styled-system/patterns';

export function UsersPage() {
  return (
    <div className={flex({ direction: 'column', gap: '6' })}>
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>Users</h1>

      <div
        className={grid({
          columns: { base: 1, lg: 3 },
          gap: '6',
          alignItems: 'start',
        })}
      >
        <div className={css({ gridColumn: { lg: 'span 2' } })}>
          <UsersTable />
        </div>

        <div
          className={css({
            p: '5',
            rounded: 'xl',
            borderWidth: '1px',
            borderColor: 'border',
            bg: 'card',
          })}
        >
          <h2
            className={css({ fontSize: 'md', fontWeight: 'semibold', mb: '4' })}
          >
            Add user
          </h2>
          <UserForm />
        </div>
      </div>
    </div>
  );
}
