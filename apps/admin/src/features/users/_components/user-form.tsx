import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { toast } from '@/shared/components/ui/toaster';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import { useCreateUser } from '../_hooks/use-users';
import {
  type TCreateUserInput,
  USER_ROLES,
  ZCreateUserInput,
} from '../schemas/user.schema';

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

export function UserForm({ onCreated }: { onCreated?: () => void }) {
  const createUser = useCreateUser();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TCreateUserInput>({
    resolver: zodResolver(ZCreateUserInput),
    defaultValues: { name: '', email: '', role: 'member' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createUser.mutateAsync(values);
    toast.success('User created', `${values.name} was added.`);
    reset();
    onCreated?.();
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={flex({ direction: 'column', gap: '4' })}
    >
      <div>
        <label htmlFor="user-name" className={labelCss}>
          Name
        </label>
        <input
          id="user-name"
          className={controlCss}
          aria-invalid={errors.name ? 'true' : undefined}
          {...register('name')}
        />
        {errors.name && <p className={errorCss}>{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="user-email" className={labelCss}>
          Email
        </label>
        <input
          id="user-email"
          type="email"
          className={controlCss}
          aria-invalid={errors.email ? 'true' : undefined}
          {...register('email')}
        />
        {errors.email && <p className={errorCss}>{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="user-role" className={labelCss}>
          Role
        </label>
        <select id="user-role" className={controlCss} {...register('role')}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Adding…' : 'Add user'}
      </Button>
    </form>
  );
}
