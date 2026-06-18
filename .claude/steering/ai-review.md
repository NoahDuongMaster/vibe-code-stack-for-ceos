# AI Code Review — How It Works

## When AI review runs

### Pre-commit (`.husky/pre-commit`)
Runs **after** `lint-staged` passes, before the commit is recorded.

- Gets the staged diff (`git diff --staged`)
- Pipes it to `claude --print` with a senior-engineer prompt
- Checks for: **bugs**, **security issues** (no secrets, no XSS), **architecture violations** (see rules below)
- Prints LGTM if clean, or lists issues concisely
- If `claude` is unavailable or errors, prints a fallback message and does NOT block the commit

**Architecture rules checked:**
1. `app/` must ONLY import from `features/[name]/index.ts` — never deep into feature internals
2. `features/[name]/_components/` and `_hooks/` must NOT be imported outside their feature folder
3. `shared/` must NOT import from `features/` or `app/`
4. `server/lib/` must NOT be imported in Client Components or `shared/`
5. Cross-feature imports are forbidden (`features/auth` importing from `features/user`)
6. Feature adapters must ONLY be called from their feature's services, not directly from components

### Post-commit (`.husky/post-commit`)
Runs immediately after the commit is recorded.

- Runs `crg-update.sh` in the background to keep the code-review-graph in sync
- Gets `git diff HEAD~1 HEAD` and asks Claude for a 1-sentence summary of what changed, plus any follow-up notes

## How to skip AI review

```sh
SKIP_AI_REVIEW=1 git commit -m "feat: ..."
```

AI review is also automatically skipped when the `CI` environment variable is set (e.g., GitHub Actions, Vercel).

## Manual review

Run from Claude Code at any time:

```
/review-changes     # graph-powered review of staged diff
/code-review        # standard review of current diff
/code-review ultra  # deep multi-agent review
```

## What it checks

| Category | Details |
|----------|---------|
| Bugs | Logic errors, null-safety, unhandled edge cases |
| Security | No secrets/tokens in code, no XSS vectors, no eval |
| Architecture | Clean Architecture layering — see rules above |
| Conventions | Named exports, no `any`, no hardcoded URLs, no `console.log` |

## Notes

- AI review never blocks a commit on its own — if it errors, the commit proceeds
- The `crg-update.sh` graph update is always fire-and-forget (background, errors suppressed)
- Review quality scales with diff size — very large diffs may get less precise feedback; prefer small focused commits
