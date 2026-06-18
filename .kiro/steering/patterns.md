---
inclusion: fileMatch
fileMatchPattern: "src/**"
---

# Canonical Patterns — AI-First Next.js Boilerplate

> Full working examples: `src/__examples__/`

## Zod Schema + Type
```typescript
// src/adapters/[domain]/[domain].schema.ts
import { z } from 'zod'
export const ZUser = z.object({ id: z.string().uuid(), email: z.string().email(), name: z.string().min(1) })
export type TUser = z.infer<typeof ZUser>
```

## Adapter
```typescript
// src/adapters/user/user.adapter.ts
import { Request } from '@/adapters/xhr'
import { API_ROUTES } from '@/constants/routes.constant'
import type { TUser } from './user.schema'
const request = new Request()
export const getUserAPI = async (id: string): Promise<TUser> =>
  request.get<TUser>(API_ROUTES.GET_USER, { id })
```

## Service
```typescript
// src/services/user.service.ts
import { getUserAPI } from '@/adapters/user/user.adapter'
import type { TUser } from '@/adapters/user/user.schema'
export const userService = {
  async getUser(id: string): Promise<TUser> { return getUserAPI(id) },
}
```

## Server Component
```tsx
import { Suspense } from 'react'
import { userService } from '@/services/user.service'
import { Skeleton } from '@/components/common/skeleton'
async function Data({ id }: { id: string }) {
  const user = await userService.getUser(id)
  return <div>{user.name}</div>
}
export default function Page({ params }: { params: { id: string } }) {
  return <Suspense fallback={<Skeleton className="h-8 w-full" />}><Data id={params.id} /></Suspense>
}
```

## Client Component (TanStack Query)
```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
export function UserCard({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['user', id], queryFn: () => userService.getUser(id) })
  if (isLoading) return <Skeleton className="h-8 w-full" />
  return <div>{data?.name}</div>
}
```

## Form (react-hook-form + Zod)
```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
const Schema = z.object({ email: z.string().email(), name: z.string().min(2) })
type Values = z.infer<typeof Schema>
export function UserForm() {
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { email: '', name: '' } })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={form.formState.isSubmitting}>Submit</Button>
      </form>
    </Form>
  )
}
```

## Zustand Store
```tsx
'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
type State = { open: boolean; setOpen: (v: boolean) => void }
export const useModalStore = create<State>()(
  persist((set) => ({ open: false, setOpen: (open) => set({ open }) }), { name: 'modal-state' })
)
```

## Custom Hook
```typescript
import { useQuery } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
export function useUser(id: string) {
  return useQuery({ queryKey: ['user', id], queryFn: () => userService.getUser(id), enabled: !!id })
}
```
