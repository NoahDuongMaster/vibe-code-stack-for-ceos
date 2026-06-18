---
inclusion: fileMatch
fileMatchPattern: "src/**"
---

# Canonical Code Patterns

> For full working examples, read `src/__examples__/` first.

## Zod Schema + Type (always together)
```typescript
// src/features/user/schemas/user.schema.ts
import { z } from 'zod'

export const ZUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
})
export type TUser = z.infer<typeof ZUser>
```

## Adapter (HTTP function — raw, no logic)
```typescript
// src/features/user/adapters/user.adapter.ts
import { Request } from '@/shared/lib/xhr'
import { API_ROUTES } from '@/shared/constants/routes.constant'
import type { TUser } from '../schemas/user.schema'

const request = new Request()

export const getUserAPI = async (id: string): Promise<TUser> =>
  request.get<TUser>(API_ROUTES.GET_USER, { id })
```

## Service (business logic — orchestrates adapters)
```typescript
// src/features/user/services/user.service.ts
import { getUserAPI } from '../adapters/user.adapter'
import type { TUser } from '../schemas/user.schema'

export const userService = {
  async getUser(id: string): Promise<TUser> {
    return getUserAPI(id)
  },
}
```

## Feature barrel export (public API)
```typescript
// src/features/user/index.ts  ← only export what app/ needs
export { userService } from './services/user.service'
export type { TUser } from './schemas/user.schema'
```

## Server Component (data fetching)
```tsx
// async function — no 'use client'
import { Suspense } from 'react'
import { userService } from '@/features/user'

async function UserData({ id }: { id: string }) {
  const user = await userService.getUser(id)
  return <div>{user.name}</div>
}

export default function UserPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="h-8 w-full animate-pulse rounded-md bg-muted" />}>
      <UserData id={params.id} />
    </Suspense>
  )
}
```

## Client Component (TanStack Query)
```tsx
// src/features/user/_components/user-card.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { userService } from '../services/user.service'

export function UserCard({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: () => userService.getUser(id),
    staleTime: 60_000,
  })
  if (isLoading) return <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
  if (error) return <div>Error loading user</div>
  return <div>{data?.name}</div>
}
```

## Form (react-hook-form + Zod + Ark UI Field)
```tsx
// src/features/user/_components/create-user-form.tsx
'use client'
import { Field } from '@ark-ui/react/field'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const Schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})
type Values = z.infer<typeof Schema>

export function CreateUserForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', name: '' },
  })

  async function onSubmit(values: Values) {
    await userService.createUser(values)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field.Root invalid={!!errors.name}>
        <Field.Label className="text-sm font-medium">Name</Field.Label>
        <Field.Input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[invalid]:border-destructive"
          {...register('name')} />
        <Field.ErrorText className="text-sm text-destructive">{errors.name?.message}</Field.ErrorText>
      </Field.Root>
      <button type="submit" disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-10 px-4 hover:bg-primary/90 transition-colors disabled:opacity-50">
        {isSubmitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  )
}
```

## Zustand Store (global, cross-feature)
```tsx
// src/shared/stores/[name].store.tsx
'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type State = { open: boolean; setOpen: (v: boolean) => void }

export const useModalStore = create<State>()(
  persist(
    (set) => ({ open: false, setOpen: (open) => set({ open }) }),
    { name: 'modal-state' }
  )
)
```

## Server Action (next-safe-action)
```typescript
// src/features/user/actions/user.action.ts
'use server'
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import { userService } from '../services/user.service'

const action = createSafeActionClient()

export const createUserAction = action
  .schema(z.object({ name: z.string().min(1), email: z.string().email() }))
  .action(async ({ parsedInput }) => {
    return userService.createUser(parsedInput)
  })
```

## API Route Handler
```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userService } from '@/features/user'

const CreateUserSchema = z.object({ name: z.string().min(1), email: z.string().email() })

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const user = await userService.createUser(parsed.data)
  return NextResponse.json({ data: user }, { status: 201 })
}
```
