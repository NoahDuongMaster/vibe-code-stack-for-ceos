## Summary

<!-- Describe what this PR does and why. Link to related issue if applicable. -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Refactor (code change that neither fixes a bug nor adds a feature)
- [ ] Documentation update
- [ ] Configuration / tooling change

## Checklist

- [ ] Follows CLAUDE.md architectural conventions (app -> services -> adapters)
- [ ] No `console.log` — uses `logger` from `@/utils/logger.helper` instead
- [ ] No hardcoded URLs — uses `API_ROUTES` / `WEB_ROUTES` from `@/constants/routes.constant`
- [ ] No adapter imports inside components — components call services only
- [ ] TypeScript passes with zero errors (`npm run type-check`)
- [ ] Tests added or updated for changed logic
- [ ] AI code review ran (e.g. `/code-review` in Claude Code)

## Testing

<!-- Describe how you tested this change. Include commands or steps to reproduce. -->

## Screenshots

<!-- If the change affects UI, attach before/after screenshots. -->
