// Public barrel — the ONLY surface importable from outside `features/auth`.
export { LoginForm } from './_components/login-form';
export { RequireAuth } from './_components/require-auth';
export { useAuth } from './_hooks/use-auth';
export { useLogin } from './_hooks/use-login';
export { AuthError } from './errors/auth.error';
export {
  type TAuthSession,
  type TAuthUser,
  type TLoginInput,
  ZLoginInput,
} from './schemas/auth.schema';
export { authService } from './services/auth.service';
export { useAuthStore } from './stores/auth.store';
