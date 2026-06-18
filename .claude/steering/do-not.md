---
inclusion: always
---

# Anti-patterns — Never Do These

## Import / Architecture
```
❌  import from features/[name]/services/ or features/[name]/adapters/ directly from app/
✓   Always import from features/[name]/index.ts (the public barrel)

❌  Cross-feature imports: features/auth importing from features/user
✓   Extract shared logic to shared/ if two features need it

❌  import from features/ inside shared/
✓   shared/ has zero knowledge of features/

❌  import from server/lib/ in a Client Component or shared/
✓   server/lib/ is server-only; call via API route or Server Component

❌  features/[name]/_components/ or _hooks/ imported outside the feature
✓   Private folders (prefix _) are feature-internal only

❌  fetch() or axios inside a component or service
✓   Use shared/lib/xhr.ts (Request class) inside adapters only
```

## HTTP / Data Fetching
```
❌  fetch('/api/users') directly in a component
✓   useQuery({ queryFn: () => featureService.getItems() }) from features/[name]/index.ts

❌  Multiple fetch calls in one useEffect
✓   Each query = one useQuery() hook, or move to Server Component

❌  Hardcoded API URLs: fetch('https://api.example.com/users')
✓   API_ROUTES from @/shared/constants/routes.constant

❌  Hardcoded web routes: router.push('/sign-in')
✓   WEB_ROUTES from @/shared/constants/routes.constant
```

## TypeScript
```
❌  : any   or   as any   or   @ts-ignore
✓   Use unknown + type guard, or define proper type

❌  process.env.MY_SECRET directly in component or service
✓   Declare in src/shared/config/env.configuration.ts, import env
```

## Components
```
❌  'use client' on layout.tsx
✓   layout.tsx must be Server Component — wrap Client Components inside

❌  useState for form field values
✓   react-hook-form for ALL form state

❌  Business logic (calculations, transforms) in page.tsx or component
✓   Move to src/features/[name]/services/

❌  console.log() in source files
✓   logger.info() / logger.error() from @/shared/utils/logger.helper (consola)

❌  Inline styles: style={{ color: 'red' }}
✓   Tailwind classes only; dynamic: cn() from @/shared/utils/tailwind.helper

❌  Default export for non-page components
✓   Named exports everywhere except page.tsx, layout.tsx, not-found.tsx
```

## Environment Variables
```
❌  New env var accessed as process.env.MY_VAR directly
✓   Declare in src/shared/config/env.configuration.ts, then import env

❌  NEXT_PUBLIC_ prefix for server-only vars
✓   Server vars have no prefix and live in env.server section
```

## Testing
```
❌  vi.mock('@/features/user/services/user.service')  — mocking services
✓   vi.mock('@/features/user/adapters/user.adapter')  — mock at HTTP boundary only

❌  vi.mock('@/shared/config/env.configuration') with wrong paths
✓   vi.mock('@/shared/config/env.configuration', () => ({ env: { ... } }))

❌  Testing implementation details (checking internal state)
✓   Test behavior: what functions return / what the user sees
```
