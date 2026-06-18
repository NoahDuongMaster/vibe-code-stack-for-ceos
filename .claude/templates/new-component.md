# Template: New Component

## Decision: ui/ or feature _components/?

```
Pure UI primitive / headless wrapper (Ark UI component)?
  → src/shared/components/ui/[name].tsx

Business component belonging to a feature?
  → src/features/[name]/_components/[name].tsx
```

## Checklist

### Server Component (default)
- [ ] No `'use client'` directive
- [ ] Props typed with explicit interface
- [ ] Data received as props (fetched by parent page)
- [ ] Named export: `export function ComponentName()`

### Client Component
- [ ] `'use client'` at top of file
- [ ] Uses `useQuery` / `useMutation` for async data (not fetch directly)
- [ ] Uses `useState` only for local UI state (not form fields)
- [ ] Uses `useForm` + `zodResolver` for any form
- [ ] Named export: `export function ComponentName()`

## File Template (feature private component)

```tsx
// src/features/user/_components/user-card.tsx
import { cn } from '@/shared/utils/tailwind.helper'
import type { TUser } from '../schemas/user.schema'

interface UserCardProps {
  user: TUser
  className?: string
}

export function UserCard({ user, className }: UserCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <h3 className="font-semibold">{user.name}</h3>
      <p className="text-sm text-muted-foreground">{user.email}</p>
    </div>
  )
}
```

## Rules
- `cn()` from `@/shared/utils/tailwind.helper` for conditional classes
- Tailwind only — no inline styles
- Max ~200 lines per component file; if longer, split into sub-components
- Private feature components: do NOT re-export from `features/[name]/index.ts` unless needed by `app/`
