---
inclusion: always
---

# Anti-patterns — Never Do

## HTTP / Data Fetching
```
❌ fetch() or axios inside a React component
✓  useQuery({ queryFn: () => userService.getUsers() })
✓  Or: async Server Component calling service directly

❌ import adapters/ in components/
✓  Components → services/ → adapters/ (strict order)
```

## TypeScript
```
❌ : any   as any   @ts-ignore   @ts-expect-error (without explanation)
✓  Use unknown + type guard, or define proper types in src/types/

❌ Non-null assertion spam: data!.user!.profile!.name
✓  Handle undefined explicitly or ensure types are correct
```

## Components & React
```
❌ 'use client' on layout.tsx
✓  layout.tsx must stay Server Component

❌ useState for form field values
✓  react-hook-form for ALL form state

❌ Business logic in page.tsx or components
✓  Belongs in src/services/

❌ console.log() in any source file
✓  logger({ message: '...', type: 'INFO' }) from @/utils/logger.helper

❌ Large useEffect with 3+ dependencies
✓  Extract into named custom hook in src/hooks/
```

## Constants & Config
```
❌ Hardcoded web routes: router.push('/sign-in')  or  href="/dashboard"
✓  WEB_ROUTES.SIGN_IN  from @/constants/routes.constant

❌ Hardcoded API URLs: request.get('api/users')
✓  API_ROUTES.GET_USERS  from @/constants/routes.constant

❌ process.env.SECRET_KEY directly in code
✓  Declare in src/config/env.configuration.ts, import env
```

## Styling
```
❌ style={{ color: 'red', marginTop: 8 }}
✓  Tailwind classes only

❌ className={isOpen ? 'block' : 'hidden'} (string concat)
✓  cn('base-class', !isOpen && 'hidden')  via cn() helper
```

## Exports
```
❌ export default function UserCard()
✓  export function UserCard()  (named, except pages/layouts)
```
