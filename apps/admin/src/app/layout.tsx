import { Switch } from '@ark-ui/react/switch';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, LogOut, Users } from 'lucide-react';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/components/ui/button';
import { ROUTES } from '@/shared/constants/routes.constant';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useUiStore } from '@/shared/stores/ui.store';
import { css, cx } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

const NAV_ITEMS = [
  {
    to: ROUTES.DASHBOARD,
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  { to: ROUTES.USERS, label: 'Users', icon: Users, end: false },
];

const navLinkCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  px: '3',
  py: '2',
  rounded: 'lg',
  fontSize: 'sm',
  fontWeight: 'medium',
  color: 'muted.foreground',
  transition: 'colors',
  _hover: { bg: 'accent', color: 'foreground' },
});
const navLinkActiveCss = css({ bg: 'secondary', color: 'foreground' });

function ThemeSwitch() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <Switch.Root
      checked={theme === 'dark'}
      onCheckedChange={(details) =>
        setTheme(details.checked ? 'dark' : 'light')
      }
      className={flex({ align: 'center', gap: '2', cursor: 'pointer' })}
    >
      <Switch.Control
        className={css({
          position: 'relative',
          w: '9',
          h: '5',
          p: '0.5',
          rounded: 'full',
          bg: 'muted',
          transition: 'background 150ms',
          '&[data-state=checked]': { bg: 'primary' },
        })}
      >
        <Switch.Thumb
          className={css({
            display: 'block',
            w: '4',
            h: '4',
            rounded: 'full',
            bg: 'white',
            transition: 'transform 150ms',
            '&[data-state=checked]': { transform: 'translateX(1rem)' },
          })}
        />
      </Switch.Control>
      <Switch.Label
        className={css({ fontSize: 'sm', color: 'muted.foreground' })}
      >
        Dark
      </Switch.Label>
      <Switch.HiddenInput />
    </Switch.Root>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <div className={flex({ align: 'center', gap: '3' })}>
      <span className={css({ fontSize: 'sm', color: 'muted.foreground' })}>
        {user?.email}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          signOut();
          // Prevents the next login (possibly a different user) from
          // flashing the previous session's cached admin data.
          queryClient.clear();
          navigate(ROUTES.LOGIN, { replace: true });
        }}
      >
        <LogOut size={16} aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}

export function AppLayout() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <div className={flex({ minH: '100vh' })}>
      {isDesktop && (
        <aside
          className={css({
            w: '60',
            flexShrink: 0,
            borderRightWidth: '1px',
            borderColor: 'border',
            bg: 'card',
            p: '4',
          })}
        >
          <div
            className={css({
              fontWeight: 'bold',
              fontSize: 'lg',
              px: '3',
              mb: '6',
            })}
          >
            @repo/admin
          </div>
          <nav className={flex({ direction: 'column', gap: '1' })}>
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(navLinkCss, isActive && navLinkActiveCss)
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
      )}

      <div className={flex({ direction: 'column', flex: '1', minW: '0' })}>
        <header
          className={flex({
            align: 'center',
            justify: 'space-between',
            h: '14',
            px: '6',
            borderBottomWidth: '1px',
            borderColor: 'border',
            bg: 'card',
          })}
        >
          <ThemeSwitch />
          <UserMenu />
        </header>

        {!isDesktop && (
          <nav
            className={flex({
              gap: '1',
              px: '4',
              py: '2',
              borderBottomWidth: '1px',
              borderColor: 'border',
              bg: 'card',
              overflowX: 'auto',
            })}
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(navLinkCss, isActive && navLinkActiveCss)
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        <main className={css({ flex: '1', p: { base: '4', md: '8' } })}>
          <NuqsAdapter>
            <Outlet />
          </NuqsAdapter>
        </main>
      </div>
    </div>
  );
}
