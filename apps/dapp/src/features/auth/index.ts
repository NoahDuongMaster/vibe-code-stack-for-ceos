// Public barrel — the ONLY surface importable from outside `features/auth`.
// Client-safe only. Server Components needing `getServerSession` must import
// from `@/features/auth/server` instead — that module pulls in `server-only`
// and would break the build if re-exported here, since Client Components
// (AuthStatus, LoginForm, the hooks below) share this same barrel.
export { AuthStatus } from './_components/auth-status';
export { LoginForm } from './_components/login-form';
export { useLogin, useLogout, useSession } from './_hooks/use-session';
export { logoutAction } from './actions/auth.action';
export { AuthError } from './errors/auth.error';
export {
  type TLoginInput,
  type TSessionData,
  type TSessionUser,
  ZLoginInput,
  ZSessionData,
  ZSessionUser,
} from './schemas/auth.schema';
export { authService } from './services/auth.service';
