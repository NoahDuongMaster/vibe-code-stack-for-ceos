'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  type TLoginInput,
  ZLoginInput,
} from '@/features/sign-in/model/login.schema';
import { useLogin } from '@/features/sign-in/model/use-login';
import { isSafeRedirectPath } from '@/shared/lib/url';
import { WEB_ROUTES } from '@/shared/routes';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

const inputStyle = css({
  px: '3',
  py: '2',
  borderWidth: '1px',
  rounded: 'md',
  fontSize: 'sm',
  w: 'full',
});

const labelStyle = css({ fontSize: 'sm', fontWeight: 'medium' });
const errorStyle = css({ fontSize: 'xs', color: 'destructive' });

/**
 * Reference login form for the sign-in slice: validates with the feature's
 * `ZLoginInput` schema, submits via `useLogin`, and redirects to the
 * middleware's `callbackUrl` (or `/account`) on success.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TLoginInput>({ resolver: zodResolver(ZLoginInput) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      const callbackUrl = searchParams.get('callbackUrl');
      router.push(
        callbackUrl && isSafeRedirectPath(callbackUrl)
          ? callbackUrl
          : WEB_ROUTES.ACCOUNT,
      );
    } catch {
      // Surfaced below via login.error — nothing further to do here.
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={flex({ direction: 'column', gap: '4', w: 'full' })}
    >
      <div className={flex({ direction: 'column', gap: '1' })}>
        <label htmlFor="email" className={labelStyle}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={inputStyle}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" role="alert" className={errorStyle}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div className={flex({ direction: 'column', gap: '1' })}>
        <label htmlFor="password" className={labelStyle}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className={inputStyle}
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" role="alert" className={errorStyle}>
            {errors.password.message}
          </p>
        )}
      </div>

      {login.isError && (
        <p
          role="alert"
          className={css({ fontSize: 'sm', color: 'destructive' })}
        >
          {login.error instanceof Error
            ? login.error.message
            : 'Something went wrong. Please try again.'}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || login.isPending}
        className={css({
          px: '5',
          py: '2',
          fontSize: 'sm',
          fontWeight: 'semibold',
          color: 'primary.foreground',
          bg: 'primary',
          rounded: 'lg',
          cursor: 'pointer',
          transition: 'colors',
          _hover: { opacity: 0.9 },
          _disabled: { opacity: 0.6, cursor: 'not-allowed' },
        })}
      >
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
