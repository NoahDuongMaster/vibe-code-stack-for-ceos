'use client';

// EXAMPLE: Form with react-hook-form + Zod + Ark UI Field
// Field.Root wires aria-invalid, aria-describedby automatically — no manual ids needed
// Key: define schema first, zodResolver wires validation, Ark UI Field for accessibility

import { Field } from '@ark-ui/react/field';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { logger } from '@/shared/utils/logger.helper';

const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
});
type CreateUserValues = z.infer<typeof CreateUserSchema>;

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
    // In production: await userService.createUser(values)
    logger.info(`Submitted: ${JSON.stringify(values)}`);
    toast.success('User created!');
    reset();
  }

  return (
    <div className="p-8 max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Form Example</h1>
        <p className="text-muted-foreground mt-1">
          Ark UI Field + react-hook-form + Zod.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create User</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field.Root invalid={!!errors.name}>
            <Field.Label className="text-sm font-medium">Name</Field.Label>
            <Field.Input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-destructive"
              placeholder="Alice"
              {...register('name')}
            />
            <Field.HelperText className="text-sm text-muted-foreground">
              Your full display name.
            </Field.HelperText>
            <Field.ErrorText className="text-sm text-destructive">
              {errors.name?.message}
            </Field.ErrorText>
          </Field.Root>

          <Field.Root invalid={!!errors.email}>
            <Field.Label className="text-sm font-medium">Email</Field.Label>
            <Field.Input
              type="email"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-destructive"
              placeholder="alice@example.com"
              {...register('email')}
            />
            <Field.ErrorText className="text-sm text-destructive">
              {errors.email?.message}
            </Field.ErrorText>
          </Field.Root>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-10 px-4 hover:bg-primary/90 transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
}
