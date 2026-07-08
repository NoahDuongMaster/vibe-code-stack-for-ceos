## Summary

<!-- What does this PR do? Keep it to 1-3 bullet points. -->

-

## Related Issue

<!-- Link the issue: Closes #123 / Fixes #456 -->

## Type of Change

<!-- PR title should follow the commit convention: type(scope): issue-123 short description -->

- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] refactor: Code change that neither fixes a bug nor adds a feature
- [ ] perf: Performance improvement
- [ ] docs: Documentation only
- [ ] test: Adding or updating tests
- [ ] build / ci / chore: Tooling, dependencies, or pipeline

## Affected Workspace(s)

<!-- Check all that this PR touches (matches the commit scope). -->

- [ ] `apps/dapp` — @repo/web (Next.js / vinext)
- [ ] `apps/admin` — @repo/admin (React / Rsbuild)
- [ ] `apps/landing` — @repo/landing (Astro)
- [ ] `services/*` — Connect RPC (api-node / api-gateway)
- [ ] `packages/*` — shared (protocol / api-core / api-client)
- [ ] Tooling — CI / Docker / config / scripts

## Test Plan

<!-- How did you verify this works? Run from the repo root. -->

- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm check:ci && pnpm lint`)
- [ ] Unit tests pass (`pnpm test`)
- [ ] Build passes (`pnpm build`)
- [ ] Manually verified the change

## Checklist

- [ ] PR title follows `type(scope): issue-123 description`
- [ ] No `any` / `as any`, no `console.log` (use the logger)
- [ ] New files follow naming conventions (kebab-case files, PascalCase exports)
- [ ] No secrets, tokens, or `.env` values committed

<details>
<summary><b>apps/dapp (Next.js) — extra checks</b></summary>

- [ ] Follows vertical-slice architecture: `app/ → features/[name]/index.ts → shared/`
- [ ] No cross-feature imports (`features/A` never imports `features/B`)
- [ ] No direct `fetch()` — use adapters / `shared/lib`
- [ ] Server Components by default — `'use client'` only when necessary

</details>

## Screenshots

<!-- If the change affects UI, attach before/after screenshots. Delete this section if not applicable. -->
