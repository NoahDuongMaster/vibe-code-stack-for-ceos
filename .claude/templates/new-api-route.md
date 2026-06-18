# Template: New API Route

Location: `src/app/api/[name]/route.ts`

## Checklist
- [ ] Validate request body/params with Zod `safeParse`
- [ ] Return 400 with `error.flatten()` on validation failure
- [ ] Call feature service via `features/[name]/index.ts` barrel — NEVER adapters directly
- [ ] Return `NextResponse.json({ data: ... })` on success
- [ ] No secrets/API keys in response
- [ ] Add route to `API_ROUTES` in `src/shared/constants/routes.constant.ts`

## Template

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { userService } from '@/features/user'

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = CreateUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const user = await userService.createUser(parsed.data)
  return NextResponse.json({ data: user }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const user = await userService.getUser(id)
  return NextResponse.json({ data: user })
}
```

## Rules
- Always validate inputs with Zod before using them
- Route handler imports from `features/[name]/index.ts` — never from internals
- Use `NextResponse.json()` — not `Response.json()`
- Session access: import `getSession` from `@/server/lib/session` (server-only)
