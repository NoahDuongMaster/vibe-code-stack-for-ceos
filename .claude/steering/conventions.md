---
inclusion: always
---

# Naming & File Conventions

## File Naming
| File type | Convention | Example |
|-----------|------------|---------|
| Component | kebab-case | `user-profile.tsx` |
| Hook | `use-` + kebab | `use-user-profile.ts` |
| Service | `.service.ts` | `user.service.ts` |
| Adapter | `.adapter.ts` | `user.adapter.ts` |
| Schema | `.schema.ts` | `user.schema.ts` |
| Store | `.store.tsx` | `user.store.tsx` |
| Type file | `.types.ts` | `user.types.ts` |
| Constant | `.constant.ts` | `user.constant.ts` |
| Action | `.action.ts` | `user.action.ts` |

## Export Naming
| Thing | Convention | Example |
|-------|------------|---------|
| Component | PascalCase | `export function UserProfile()` |
| Hook | camelCase + `use` | `export function useUserProfile()` |
| Zod schema | `Z` prefix | `export const ZUser = z.object(...)` |
| Derived type | `T` prefix | `export type TUser = z.infer<typeof ZUser>` |
| Constant value | SCREAMING_SNAKE | `API_ROUTES.GET_USER` |
| Zustand hook | `use` + Name + `Store` | `export const useUserStore = create(...)` |
| Service object | camelCase + `Service` | `export const userService = { ... }` |

## Export Style
- **Named exports** for everything except Next.js file conventions
- **Default exports** ONLY for: `page.tsx`, `layout.tsx`, `not-found.tsx`, `error.tsx`, `loading.tsx`
- Feature public API via `features/[name]/index.ts` barrel only

## File Placement Quick Reference
```
New page                 → src/app/[route]/page.tsx
New API route            → src/app/api/[name]/route.ts
Private feature UI       → src/features/[name]/_components/[name].tsx
Private feature hook     → src/features/[name]/_hooks/use-[name].ts
HTTP API call            → src/features/[name]/adapters/[name].adapter.ts
Business logic           → src/features/[name]/services/[name].service.ts
Zod schema + types       → src/features/[name]/schemas/[name].schema.ts
Server action            → src/features/[name]/actions/[name].action.ts
Feature public exports   → src/features/[name]/index.ts
Global UI state          → src/shared/stores/[name].store.tsx
Generic reusable hook    → src/shared/hooks/use-[name].ts
Global type              → src/shared/types/[domain].types.ts
App constant             → src/shared/constants/[name].constant.ts
Env var                  → src/shared/config/env.configuration.ts
Server-only utility      → src/server/lib/[name].ts
```

## Import Order (ESLint enforced)
```typescript
// 1. React / Next.js
import { useState } from 'react'
import type { Metadata } from 'next'

// 2. External packages (alphabetical)
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

// 3. Internal @/ alias (shared → features → server)
import { cn } from '@/shared/utils/tailwind.helper'
import { API_ROUTES } from '@/shared/constants/routes.constant'
import type { TUser } from '@/shared/types'
import { userService } from '@/features/user'
```
