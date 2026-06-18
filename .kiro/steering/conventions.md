---
inclusion: always
---

# Conventions — AI-First Next.js Boilerplate

## File Naming
| Type | Pattern | Example |
|------|---------|---------|
| Component | kebab-case | `user-profile.tsx` |
| Hook | `use-` + kebab | `use-user.ts` |
| Service | `.service.ts` | `user.service.ts` |
| Adapter | `.adapter.ts` | `user.adapter.ts` |
| Schema | `.schema.ts` | `user.schema.ts` |
| Store | `.store.tsx` | `user.store.tsx` |
| Types | `.types.ts` | `user.types.ts` |
| Constants | `.constant.ts` | `routes.constant.ts` |

## Export Naming
- Components: `PascalCase` named export
- Hooks: `camelCase` with `use` prefix
- Zod schemas: `Z` prefix → `ZUser`
- Derived types: `T` prefix → `TUser`
- Zustand: `useXxxStore` → `useUserStore`
- Services: `xxxService` → `userService = { ... }`
- Constants: `SCREAMING_SNAKE_CASE`

## Export Style
- Named exports for ALL code
- Default exports ONLY for: page.tsx, layout.tsx, not-found.tsx, error.tsx, loading.tsx

## File Placement
```
New page           → src/app/[route]/page.tsx
New API route      → src/app/api/[name]/route.ts
UI primitive       → src/components/common/[name].tsx
Business component → src/components/features/[name].tsx
HTTP call          → src/adapters/[domain]/[domain].adapter.ts
Business logic     → src/services/[domain].service.ts
Global UI state    → src/stores/[name].store.tsx
Shared hook        → src/hooks/use-[name].ts
Shared type        → src/types/[domain].types.ts
Constant           → src/constants/[name].constant.ts
```
