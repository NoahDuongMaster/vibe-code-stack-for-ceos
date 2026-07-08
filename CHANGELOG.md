# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) (Olivier Lacan, 2014).
Versioning follows [Semantic Versioning 2.0.0](https://semver.org/).

---

## [1.1.0](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/compare/vibe-code-stack-for-ceos-v1.0.0...vibe-code-stack-for-ceos-v1.1.0) (2026-07-08)


### Features

* add animation ([6ac2852](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/6ac2852c2a0b04256e1b6c9092d39d3aa58d50e7))
* add global loading ([bc2631b](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/bc2631be5436fb78afacc85bac21b687029cab2d))
* add global loading ([140cc11](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/140cc113257c989ca88d7830798e21e6f45c4413))
* added storybook to the project ([5019bb3](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/5019bb3d5cc7241de21cb88390a699fba291ae31))
* added storybook to the project ([b09ac39](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/b09ac3993514b62e905d0280907aa871f3a37e01))
* admin dashboard ([7677dd7](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/7677dd7997cb1575b7e7d1b568b46e62543c64b8))
* admin dashboard ([41e9ab1](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/41e9ab165b95caa40f409f1c0496d0ee0a46d1b2))
* ci cd ([34ab202](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/34ab202506f5414df895d384066bdc9af9230a2e))
* ci cd ([219187c](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/219187c2949316d3a7dbd54f04f4af2be9d1355b))
* connect solana wallet ([b5c9c0a](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/b5c9c0a5bf78806453fc8dd3541459fafda98af3))
* **dapp:** no-issue  enhance project configuration and add new components ([f04579d](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/f04579d15edb13a172c988bca8b974ade7dbfc08))
* graphql ([2925a7e](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/2925a7ecb909e8c1a544ef16178f58f5fd4a09e4))
* graphql ([2005983](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/2005983930998fd9f8caf59a13b17e613d7766e0))
* update ([2bf83a6](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/2bf83a690d60657429a0de3396036ad0b5ca943e))
* update ([016208a](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/016208a3be55af16851ce90d8d004c586d9be6da))
* update README ([127f232](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/127f232b35ecb5fe9123a4da7b6e84048ec79483))
* update stylelint ([92b294f](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/92b294f386de985b0e8f65fd175b46c2a75b3143))


### Bug Fixes

* antd SSR ([f8ff98a](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/f8ff98a3dba372db3b0619d5eec1907c6a19f4a7))
* antd SSR ([12b253f](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/12b253fdae707ee480bf1b189bcbe45404920c9d))
* change extension hook file ([1aa872a](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/1aa872a4d0a25b8d1a9da256cdbbbc0707a44315))
* hotfix ; ([904f9d2](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/904f9d24d3c4f037f99e79ab7f91cec92c90c977))
* hotfix ; ([1fa26b3](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/1fa26b3bf18761ad847396cb2c4415eee3e740c5))
* node version github action ([285d0bc](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/285d0bcb3bf91af42b9a284a1db1f0f6b5d6a981))
* update ([a3ab999](https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos/commit/a3ab999de88033aa51635bdfe0e5af2ff5d7beac))

## [Unreleased]

### Changed
- **Migrated from a single Next.js app to a pnpm + Turborepo monorepo**: the app moved to `apps/dapp/` (package `@repo/web`), joined by `apps/admin/` (Rsbuild/React Router SPA) and `apps/landing/` (Astro marketing site); shared Connect-RPC contracts extracted to `packages/protocol`, `packages/api-core`, `packages/api-client`; backend split into `services/api-gateway` (Cloudflare Workers) and `services/api-node` (Node.js)
- Removed the multi-IDE AI-config generator (`scripts/gen-ai-config.sh`, `.ai/rules.md`) — `CLAUDE.md` is now hand-edited and is the single source of truth for architecture rules (see commit `4c33463`)
- Switched package manager to pnpm (`packageManager: pnpm@11.2.2`, `only-allow pnpm` preinstall guard)

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

[Unreleased]: https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate/releases/tag/v1.0.0
