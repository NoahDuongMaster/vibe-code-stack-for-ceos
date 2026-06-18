# GitHub Copilot Instructions — AI-First Next.js Boilerplate

You are assisting in an AI-first Next.js 15 boilerplate. Apply these rules to every suggestion.

## Stack

- **Framework**: Next.js 15 App Router, React 19, TypeScript strict mode
- **Styling**: Tailwind CSS v4 (CSS-first, no tailwind.config.ts) + Ark UI (`@ark-ui/react`)
- **Data**: TanStack Query v5 for server state, Zustand v5 for UI state
- **Forms**: react-hook-form + Zod v4 — never useState for form fields
- **HTTP**: ofetch via `src/adapters/xhr.ts` — never use fetch() or axios directly
- **Auth**: iron-session v8 (stateless encrypted cookies)
- **Validation**: Zod v4 — schemas in `*.schema.ts`, types derived with `z.infer<>`
- **Testing**: Vitest + Testing Library + MSW v2 for unit, Playwright for E2E
- **Linting**: Biome v2 (format + lint), ESLint (Next.js rules only)

## Architecture (STRICT — never violate)

```
app/page.tsx  →  services/*.service.ts  →  adapters/*.adapter.ts  →  External API
```

- Components only import from `services/`, never from `adapters/`
- Services never import from `components/` or `app/`
- Adapters never import from `services/`, `components/`, or `app/`

## Component Rules

```ts
// Server Component (default — no directive)
export default async function Page() { ... }

// Client Component — only when needed
'use client'
export function InteractiveWidget() { ... }
```

When to add `'use client'`: useState, useEffect, event handlers, browser APIs, TanStack Query hooks.
**NEVER** add `'use client'` to layout.tsx.

## Naming

| Thing | Convention |
|-------|-----------|
| Zod schema | `const ZUser = z.object(...)` |
| Derived type | `type TUser = z.infer<typeof ZUser>` |
| Constant | `API_ROUTES.GET_USER` (SCREAMING_SNAKE) |
| Store hook | `useUserStore` |
| Component export | Named export (`export function UserCard`) |
| Page/layout | Default export only |

## Code Patterns

### Adapter (HTTP layer)
```ts
// src/adapters/user/user.adapter.ts
import { Request } from '@/adapters/xhr'
const request = new Request()
export const getUserAPI = async (id: string) =>
  request.get<TUser>(`${API_ROUTES.GET_USER}/${id}`)
```

### Service (business logic)
```ts
// src/services/user.service.ts
import { getUserAPI } from '@/adapters/user/user.adapter'
export const userService = {
  async getUser(id: string) { return getUserAPI(id) },
}
```

### TanStack Query hook
```ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
export function useUser(id: string) {
  return useQuery({ queryKey: ['users', id], queryFn: () => userService.getUser(id) })
}
```

### Zod schema + type
```ts
// src/adapters/user/user.schema.ts
import { z } from 'zod'
export const ZUser = z.object({ id: z.string().uuid(), email: z.string().email() })
export type TUser = z.infer<typeof ZUser>
```

## Anti-patterns — NEVER suggest

- `fetch()` or `axios` inside a component or hook
- `useState` for form field values (use react-hook-form)
- `console.log()` (use consola logger)
- Hardcoded URLs — always use `API_ROUTES` / `WEB_ROUTES` from `@/constants/`
- `import from '@/adapters/'` inside any component
- `type: any` or `as any`
- `process.env.MY_VAR` directly — use `src/config/env.configuration.ts`
- `style={{ ... }}` inline styles — use Tailwind classes with `cn()`
- Default exports for components (only for page.tsx, layout.tsx, not-found.tsx)

## Testing Pattern

```ts
// Mock adapters, NEVER mock services
vi.mock('@/adapters/user/user.adapter')

describe('userService.getUser', () => {
  it('calls adapter with correct id', async () => {
    vi.mocked(getUserAPI).mockResolvedValue(mockUser)
    const result = await userService.getUser('1')
    expect(result).toEqual(mockUser)
    expect(getUserAPI).toHaveBeenCalledWith('1')
  })
})
```

## Canonical Examples

Read `src/__examples__/` before writing new features:
- `_server-data/` — Server Component + async data + Suspense
- `_client-state/` — Client Component + Zustand
- `_form/` — react-hook-form + Zod
- `_full-feature/` — complete: schema → adapter → service → hook → page
