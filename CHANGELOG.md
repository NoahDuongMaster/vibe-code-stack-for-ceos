# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) (Olivier Lacan, 2014).
Versioning follows [Semantic Versioning 2.0.0](https://semver.org/).

---

## [Unreleased]

### Added
- Multi-agent Playwright E2E test suite (`e2e/smoke.test.ts`, `e2e/navigation.test.ts`)
- GitHub Actions workflows: CI pipeline, CodeQL security analysis, Playwright E2E
- MSW v2 network-layer mocking (`src/__test__/mocks/`)
- Unit tests for XHR adapter, post service, and session hook (24 tests)
- DevTools component: `@tanstack/react-query-devtools` + `react-scan` (dev-only)
- Content Security Policy headers in `next.config.ts` (report-only in dev, enforced in prod)
- Path traversal protection in `src/middleware.ts` (OWASP CWE-22)
- `public/.well-known/security.txt` per RFC 9116
- `src/utils/sanitize.helper.ts` — URL sanitization + origin validation
- `src/instrumentation.ts` — Next.js `onRequestError` telemetry hook
- AI config files: `OPENCODE.md`, `.github/copilot-instructions.md`
- Claude Code skills: `graphify`, `review-changes`, `debug-issue`, `refactor-safely`, `explore-codebase`
- Claude Code steering: `architecture.md`, `conventions.md`, `do-not.md`, `patterns.md`, `ai-review.md`
- `.claude/templates/` for new-api-route, new-component, new-feature
- `docs/standards.md` — all international standards and scientific references
- `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`
- `.github/pull_request_template.md`, `.github/CODEOWNERS`
- Docker three-tier setup (development / staging / production)
- Pre-commit AI code review via Claude (`SKIP_AI_REVIEW=1` to bypass in CI)
- Post-commit knowledge graph update (`code-review-graph update`)

### Changed
- Migrated from **Biome v1** to **Biome v2** (`organizeImports` → `assist`, `files.ignore` → `files.includes`)
- `useEffect` in `global.store.tsx` — scoped `matchMode` inside effect, added `removeEventListener` cleanup
- CI workflow rebuilt as parallel multi-job pipeline (typecheck / lint / test / security / build)
- Health endpoint response shape aligned with draft Health Check Response Format for HTTP APIs
- `AGENTS.md` updated to match CLAUDE.md stack (Ark UI, ofetch, correct folder paths)

### Fixed
- `noArrayIndexKey` Biome rule in `src/__examples__/` — resolved via `biome.json` overrides
- `useButtonType` missing on 5 button elements
- `useHtmlLang` missing on `global-error.tsx`
- `noSvgWithoutTitle` on `not-found.tsx`
- `useExhaustiveDependencies` in `global-error.tsx` and `global.store.tsx`

---

## [1.0.0] — 2026-06-17

### Added
- Initial release
- Next.js 15 App Router + React 19 + TypeScript strict
- Tailwind CSS v4 (CSS-first, OKLCH) + Ark UI v5
- TanStack Query v5 + Zustand v5
- react-hook-form + Zod v4
- iron-session v8 + next-safe-action v8 + nuqs v2
- ofetch v1 wrapped in `src/adapters/xhr.ts`
- Biome v2 + ESLint (Next.js rules only) + commitlint
- Husky v9 + lint-staged
- Vitest v4 + Testing Library + jsdom
- Four canonical examples: `_server-data`, `_client-state`, `_form`, `_full-feature`
- Graphify knowledge graph (`graphify-out/graph.json`)
- Code Review Graph MCP server (`.mcp.json`, `.cursor/mcp.json`)
- Multi-AI convention files: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `QODER.md`, `.windsurfrules`
- `.kiro/steering/` rules (architecture, conventions, do-not, patterns)
- Three Docker environments (development, staging, production)

[Unreleased]: https://github.com/truongdn-it/nextjs-boilerplate/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/truongdn-it/nextjs-boilerplate/releases/tag/v1.0.0
