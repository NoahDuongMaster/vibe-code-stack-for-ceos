'use client';

// EXAMPLE: Form with react-hook-form + Zod + Ark UI Field
// Field.Root wires aria-invalid, aria-describedby automatically — no manual ids needed
// Key: define schema first, zodResolver wires validation, Ark UI Field for accessibility

import { Field } from '@ark-ui/react/field';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toaster } from '@/shared/lib/toaster';
import { logger } from '@/shared/utils/logger.helper';
import { css } from '@/styled-system/css';

const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
});
type CreateUserValues = z.infer<typeof CreateUserSchema>;

const inputStyles = css({
  display: 'flex',
  h: '10',
  w: 'full',
  rounded: 'md',
  borderWidth: '1px',
  borderColor: 'input',
  bg: 'background',
  px: '3',
  py: '2',
  fontSize: 'sm',
  _placeholder: { color: 'muted.foreground' },
  _focusVisible: { outline: 'none', ring: '2px solid', ringColor: 'ring' },
  _disabled: { cursor: 'not-allowed', opacity: 0.5 },
  _invalid: { borderColor: 'destructive' },
});

export default function FormExamplePage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: { name: '', email: '' },
  });

  async function onSubmit(values: CreateUserValues) {
    logger.info(`Submitted: ${JSON.stringify(values)}`);
    toaster.success({ title: 'User created!' });
    reset();
  }

  return (
    <div
      className={css({
        p: '8',
        maxW: 'md',
        mx: 'auto',
        display: 'flex',
        flexDir: 'column',
        gap: '6',
      })}
    >
      <div>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
          Form Example
        </h1>
        <p className={css({ color: 'muted.foreground', mt: '1' })}>
          Ark UI Field + react-hook-form + Zod.
        </p>
      </div>

      <div
        className={css({
          rounded: 'lg',
          borderWidth: '1px',
          bg: 'card',
          p: '6',
          display: 'flex',
          flexDir: 'column',
          gap: '4',
        })}
      >
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>
          Create User
        </h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className={css({ display: 'flex', flexDir: 'column', gap: '4' })}
        >
          <Field.Root invalid={!!errors.name}>
            <Field.Label
              className={css({ fontSize: 'sm', fontWeight: 'medium' })}
            >
              Name
            </Field.Label>
            <Field.Input
              className={inputStyles}
              placeholder="Alice"
              {...register('name')}
            />
            <Field.HelperText
              className={css({ fontSize: 'sm', color: 'muted.foreground' })}
            >
              Your full display name.
            </Field.HelperText>
            <Field.ErrorText
              className={css({ fontSize: 'sm', color: 'destructive' })}
            >
              {errors.name?.message}
            </Field.ErrorText>
          </Field.Root>

          <Field.Root invalid={!!errors.email}>
            <Field.Label
              className={css({ fontSize: 'sm', fontWeight: 'medium' })}
            >
              Email
            </Field.Label>
            <Field.Input
              type="email"
              className={inputStyles}
              placeholder="alice@example.com"
              {...register('email')}
            />
            <Field.ErrorText
              className={css({ fontSize: 'sm', color: 'destructive' })}
            >
              {errors.email?.message}
            </Field.ErrorText>
          </Field.Root>

          <button
            type="submit"
            disabled={isSubmitting}
            className={css({
              w: 'full',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              rounded: 'md',
              bg: 'primary',
              color: 'primary.foreground',
              fontSize: 'sm',
              fontWeight: 'medium',
              h: '10',
              px: '4',
              cursor: 'pointer',
              transition: 'colors',
              _hover: { opacity: 0.9 },
              _disabled: { pointerEvents: 'none', opacity: 0.5 },
            })}
          >
            {isSubmitting ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
}
