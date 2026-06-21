## Summary

<!-- What does this PR do? Keep it to 1-3 bullet points. -->

-

## Related Issue

<!-- Link the issue: Closes #123 / Fixes #456 -->

## Type of Change

- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] refactor: Code change that neither fixes a bug nor adds a feature
- [ ] docs: Documentation only
- [ ] test: Adding or updating tests
- [ ] chore: Build process, tooling, or dependency updates

## Test Plan

<!-- How did you verify this works? -->

- [ ] Unit tests pass (`npm run test:check`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint && npm run lint:biome`)
- [ ] Manually tested in browser

## Checklist

- [ ] Follows architecture rules: `app/ → features/[name]/index.ts → shared/`
- [ ] No `any` types, no `console.log`, no direct `fetch()` calls
- [ ] No cross-feature imports (`features/A` never imports `features/B`)
- [ ] New files use correct naming conventions (kebab-case files, PascalCase exports)
- [ ] Server Components by default — `'use client'` only when necessary
- [ ] Tests added or updated for changed logic

## Screenshots

<!-- If the change affects UI, attach before/after screenshots. Delete this section if not applicable. -->
