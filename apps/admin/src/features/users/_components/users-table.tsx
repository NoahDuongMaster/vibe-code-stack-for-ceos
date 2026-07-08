import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { parseAsString, useQueryState } from 'nuqs';
import { formatDate } from '@/shared/utils/format';
import { css, cx } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import { useUsers } from '../_hooks/use-users';
import type { TUser } from '../schemas/user.schema';

const ROLE_COLOR: Record<TUser['role'], string> = {
  admin: 'oklch(0.55 0.2 25)',
  member: 'oklch(0.55 0.15 250)',
  viewer: 'oklch(0.55 0.02 260)',
};

function RoleBadge({ role }: { role: TUser['role'] }) {
  return (
    <span
      className={css({
        display: 'inline-block',
        px: '2',
        py: '0.5',
        rounded: 'full',
        fontSize: 'xs',
        fontWeight: 'medium',
        color: 'white',
      })}
      style={{ backgroundColor: ROLE_COLOR[role] }}
    >
      {role}
    </span>
  );
}

const columnHelper = createColumnHelper<TUser>();
const columns = [
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('email', { header: 'Email' }),
  columnHelper.accessor('role', {
    header: 'Role',
    cell: (info) => <RoleBadge role={info.getValue()} />,
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created',
    cell: (info) => formatDate(info.getValue()),
  }),
];

const cellCss = css({ px: '4', py: '3', textAlign: 'left', fontSize: 'sm' });
const headCss = css({
  px: '4',
  py: '3',
  textAlign: 'left',
  fontSize: 'xs',
  fontWeight: 'semibold',
  textTransform: 'uppercase',
  letterSpacing: 'wider',
  color: 'muted.foreground',
});

export function UsersTable() {
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useUsers();
  // URL-synced search (nuqs) — shareable/bookmarkable filter state.
  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''));

  const table = useReactTable({
    data: users,
    columns,
    state: { globalFilter: q },
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === 'function' ? updater(q) : updater;
      void setQ(next ?? '');
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className={flex({ direction: 'column', gap: '4' })}>
      <input
        type="search"
        value={q}
        onChange={(e) => void setQ(e.target.value)}
        placeholder="Search users…"
        aria-label="Search users"
        className={css({
          px: '3',
          py: '2',
          rounded: 'lg',
          borderWidth: '1px',
          borderColor: 'input',
          bg: 'background',
          fontSize: 'sm',
          maxW: 'sm',
          _focusVisible: { outline: '2px solid', outlineColor: 'ring' },
        })}
      />

      <div
        className={css({
          borderWidth: '1px',
          borderColor: 'border',
          rounded: 'xl',
          overflow: 'hidden',
          bg: 'card',
        })}
      >
        <table className={css({ w: 'full', borderCollapse: 'collapse' })}>
          <thead className={css({ bg: 'secondary' })}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={headCss}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={cx(
                    cellCss,
                    css({ color: 'muted.foreground', textAlign: 'center' }),
                  )}
                >
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={cx(cellCss, css({ textAlign: 'center' }))}
                >
                  <div
                    className={flex({
                      direction: 'column',
                      align: 'center',
                      gap: '2',
                      py: '2',
                    })}
                  >
                    <span
                      className={css({
                        color: 'destructive',
                        fontWeight: 'medium',
                      })}
                    >
                      Couldn&apos;t load users
                      {error instanceof Error ? `: ${error.message}` : '.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      disabled={isRefetching}
                      className={css({
                        px: '3',
                        py: '1',
                        rounded: 'md',
                        borderWidth: '1px',
                        borderColor: 'input',
                        fontSize: 'xs',
                        fontWeight: 'medium',
                        bg: 'background',
                        cursor: 'pointer',
                        _disabled: { opacity: '0.6', cursor: 'not-allowed' },
                      })}
                    >
                      {isRefetching ? 'Retrying…' : 'Retry'}
                    </button>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={cx(
                    cellCss,
                    css({ color: 'muted.foreground', textAlign: 'center' }),
                  )}
                >
                  No users match “{q}”.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={css({ _hover: { bg: 'accent' } })}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cellCss}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className={css({ fontSize: 'xs', color: 'muted.foreground' })}>
        {rows.length} of {users.length} users
      </p>
    </div>
  );
}
