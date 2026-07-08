import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { toast } from '@/shared/components/ui/toaster';
import { ROUTES } from '@/shared/constants/routes.constant';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import { useLogin } from '../_hooks/use-login';
import { type TLoginInput, ZLoginInput } from '../schemas/auth.schema';

const labelCss = css({
  display: 'block',
  mb: '1.5',
  fontSize: 'sm',
  fontWeight: 'medium',
});
const controlCss = css({
  w: 'full',
  px: '3',
  py: '2',
  rounded: 'lg',
  borderWidth: '1px',
  borderColor: 'input',
  bg: 'background',
  fontSize: 'sm',
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'ring',
    outlineOffset: '1px',
  },
  '&[aria-invalid=true]': { borderColor: 'destructive' },
});
const errorCss = css({ mt: '1', fontSize: 'xs', color: 'destructive' });

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const from =
    (location.state as { from?: string } | null)?.from ?? ROUTES.DASHBOARD;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TLoginInput>({
    resolver: zodResolver(ZLoginInput),
    // Demo credentials pre-filled for the boilerplate — any valid pair works.
    defaultValues: { email: 'admin@example.com', password: 'password' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      toast.success('Signed in', 'Welcome back.');
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(
        'Sign in failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={flex({ direction: 'column', gap: '4' })}
    >
      <div>
        <label htmlFor="login-email" className={labelCss}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          className={controlCss}
          aria-invalid={errors.email ? 'true' : undefined}
          {...register('email')}
        />
        {errors.email && <p className={errorCss}>{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="login-password" className={labelCss}>
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className={controlCss}
          aria-invalid={errors.password ? 'true' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <p className={errorCss}>{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
