<div align="center">

# 🤖 AI-First Next.js Boilerplate

**The most opinionated, production-ready Next.js boilerplate with first-class AI tooling**

Ship full-stack Next.js apps faster with a battle-tested architecture that every AI coding assistant understands out of the box — Claude Code, Cursor, Gemini CLI, Kiro, Windsurf, and more all produce consistent, reviewable code from day one.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Biome](https://img.shields.io/badge/Biome-v2-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev)
[![Vitest](https://img.shields.io/badge/Vitest-v4-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)

</div>

---

## Why This Boilerplate?

| | `create-next-app` | `t3-app` | **AI-First Boilerplate** |
|---|---|---|---|
| Architecture conventions | None | Partial | Strict, ESLint-enforced |
| AI tool config | None | None | Claude, Cursor, Gemini, Kiro, Windsurf |
| Pre-commit AI code review | No | No | Yes (Code Review Graph MCP) |
| Type-safe server actions | No | No | Yes (next-safe-action v8) |
| Headless UI primitives | None | None | Ark UI v5 (unstyled, accessible) |
| Canonical examples | No | No | Yes (`src/__examples__/`) |
| Docker (dev/staging/prod) | No | No | Yes (three-tier) |
| Security headers | No | No | Yes (CSP, HSTS, OWASP) |
| International standards | No | Partial | Full (commitlint, branch rules, layered arch) |

---

## Features

### AI-First Development
- **CLAUDE.md** — single source of truth for Claude Code, Cursor, Copilot, DeepSeek, and any AI assistant
- **GEMINI.md** — Gemini CLI project context and steering rules
- **AGENTS.md** — Kiro / OpenAI Agents compatible spec
- **QODER.md** — Code Review Graph MCP integration guide
- `.claude/steering/` and `.kiro/steering/` — per-AI rule files that override global behavior
- Pre-commit AI code review via **Code Review Graph MCP** (semantic impact analysis before every commit)
- Canonical examples in `src/__examples__/` — AI reads these before generating new code

### Architecture
- Strict three-layer architecture: `app → services → adapters → External API`, enforced by ESLint custom rules
- Named exports everywhere (except `page.tsx` / `layout.tsx`) — no default-export ambiguity
- Type-safe server actions with **next-safe-action v8** — end-to-end typed mutations
- Stateless encrypted cookie sessions via **iron-session v8**
- Universal HTTP client via **ofetch v1** wrapped in `adapters/xhr.ts` — same API on browser, Edge, and SSR

### Developer Experience
- **Biome v2** — ultra-fast format + lint in one tool (replaces Prettier + partial ESLint)
- **TypeScript 6** strict mode — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled
- **Husky v9** + **commitlint** — branch name validation, commit message format enforced pre-push
- **Turbopack** dev server — sub-second HMR
- **react-scan** — runtime performance overlay in development
- `src/__examples__/` — four canonical patterns AI assistants reference before writing new code

### UI
- **Tailwind CSS v4** — CSS-first config, OKLCH color space, no `tailwind.config.js` required
- **Ark UI v5** — headless, WAI-ARIA compliant primitives (zero vendor lock-in on styles)
- **Motion (Framer Motion v12)** — tree-shakeable animation library, imported from `motion/react`
- **Lucide React v1** — consistent icon set
- **Sonner v2** — toast notifications
- `cn()` helper via `tailwind-merge` + `clsx` — conflict-safe className composition

### Security
- Content Security Policy (CSP) headers configured in `next.config.ts`
- HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- OWASP Top 10 considerations documented in `SECURITY.md`
- `public/.well-known/security.txt` — responsible disclosure policy
- Middleware-based route protection

### Testing
- **Vitest v4** with `@vitest/ui` — browser-like test environment via jsdom
- **Testing Library** (React + DOM + user-event) — behavior-driven component tests
- **MSW v2** — API mocking at the network layer (no service mocks)
- **Playwright v1.61** — end-to-end tests
- Coverage via `@vitest/coverage-v8`
- Convention: mock adapters, never services

### State Management
- **TanStack Query v5** — server state, async data, cache invalidation
- **Zustand v5** — lightweight client UI state with `persist` middleware
- **nuqs v2** — URL search param state (filters, pagination, search)
- **react-hook-form v7** + **Zod v4** — type-safe forms, never `useState` for fields
- **TanStack Table v8** — headless data tables with sorting, filtering, pagination

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/truongdn-it/nextjs-boilerplate
cd nextjs-boilerplate

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and fill in your values before connecting to external services.

---

## Folder Structure

```
src/
├── __examples__/          Canonical patterns — AI reads these before writing
│   ├── _server-data/      Server Component + async fetch + Suspense
│   ├── _client-state/     Client Component + Zustand + event handlers
│   ├── _form/             react-hook-form + Zod validation
│   └── _full-feature/     schema → adapter → service → page → component
│
├── __test__/              Test files mirroring src structure
│   └── services/          Unit tests for service layer
│
├── adapters/              Raw HTTP functions (one file per domain)
│   └── [domain]/
│       ├── [domain].adapter.ts   One function per API endpoint
│       └── [domain].schema.ts    Zod schemas + inferred types
│
├── app/                   Next.js App Router pages + API routes
│   ├── api/               Route handlers
│   └── (web3)/            Isolated blockchain routes (optional)
│
├── components/
│   └── features/          Business components (Ark UI + plain Tailwind)
│
├── config/                Env vars (T3 OSS) + app config — no hardcoded secrets
├── constants/             Routes (API_ROUTES, WEB_ROUTES), SEO, static data
├── hooks/                 Shared React hooks (use-[name].ts)
├── lib/                   iron-session config, third-party wrappers
├── services/              Business logic — orchestrates adapters
├── stores/                Zustand stores (*.store.tsx) + QueryClient provider
├── styles/                Global CSS only (Tailwind entry point)
├── types/                 Shared TypeScript types ([domain].types.ts)
└── utils/                 Pure utility functions — no side effects, no API calls
```

**Architecture data flow:**
```
app/ (page.tsx / route.ts)
        ↓
services/ (business logic, orchestration)
        ↓
adapters/ (raw HTTP calls, one function per endpoint)
        ↓
External API
```

**Hard rule:** `components/` never imports from `adapters/` directly — always through `services/`.

---

## AI Tooling

This project is designed so every AI assistant produces architecturally consistent code without custom prompting.

### Claude Code

`CLAUDE.md` (project root) is the primary spec file. It defines:
- Decision trees for file placement, component type, and state management
- Naming conventions and anti-patterns
- Exact code patterns to copy (Zod schemas, adapters, services, forms, stores)
- Quality gate requirements

`.claude/steering/` contains per-topic rule files loaded automatically.

**Pre-commit AI review** via Code Review Graph MCP:

```bash
# Automatically triggered on git commit via Husky
# Performs semantic impact analysis — flags high-risk changes before they land
```

**MCP tools available in Claude Code:**

| Tool | When to use |
|------|-------------|
| `semantic_search_nodes` | Find function/component by concept |
| `get_impact_radius` | Blast radius before refactoring |
| `detect_changes` | Review staged changes with risk score |
| `query_graph pattern="callers_of"` | Find all callers of a function |
| `get_architecture_overview` | Understand module community structure |

### Other AI IDEs

| Tool | Config file | What it does |
|------|-------------|--------------|
| Cursor | `.cursorrules` | Architecture rules + naming conventions |
| Windsurf | `.windsurfrules` | Same rules, Windsurf format |
| Gemini CLI | `GEMINI.md` + `.gemini/` | Project context + steering |
| Kiro | `AGENTS.md` + `.kiro/steering/` | Spec-driven agent rules |
| OpenAI Agents | `AGENTS.md` | Universal agent spec |
| Any tool | `CLAUDE.md` | Universal fallback — all rules in one file |

All config files enforce **identical rules** — two developers using different AI tools produce code that looks like it was written by the same person.

### Code Review Graph MCP

`QODER.md` documents the Code Review Graph MCP server integration. It provides:
- Persistent incremental knowledge graph of the codebase (Tree-sitter parsed)
- Semantic code search across the graph
- Impact radius analysis before merging
- Community detection to understand module boundaries

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server (standalone) |
| `npm run start:dev` | Start Next.js dev server (no Turbopack) |
| `npm run type-check` | TypeScript check — zero errors required |
| `npm run lint` | ESLint (Next.js rules + architecture rules) |
| `npm run lint:biome` | Biome check + auto-fix |
| `npm run format` | Biome format all files |
| `npm run test` | Vitest with UI |
| `npm run test:check` | Vitest CI mode (no UI) |
| `npm run test:coverage` | Coverage report (v8) |
| `npm run build:development` | Docker build — development image |
| `npm run start:development` | Docker start — development container |
| `npm run build:staging` | Docker build — staging image |
| `npm run start:staging` | Docker start — staging container |
| `npm run build:production` | Docker build — production image |
| `npm run start:production` | Docker start — production container |

---

## Environment Variables

Declared in `src/config/env.configuration.ts` using `@t3-oss/env-nextjs`. Never use `process.env.VAR` directly in application code — import from `env` instead.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL of the app |
| `SESSION_SECRET` | Yes | iron-session encryption secret (32+ chars) |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL for external API calls |
| `ANALYZE` | No | Set to `true` to open bundle analyzer |

Add new variables to `src/config/env.configuration.ts` with Zod validation before using them anywhere in the codebase.

---

## Docker

Three-tier Docker setup with separate Compose files per environment.

```bash
# Development  (hot-reload, source maps, React DevTools)
npm run build:development && npm run start:development
# → http://localhost:3001

# Staging  (production build, staging env vars)
npm run build:staging && npm run start:staging
# → http://localhost:3002

# Production  (standalone output, minimal image)
npm run build:production && npm run start:production
# → http://localhost:80
```

Compose files live in `docker/development/`, `docker/staging/`, and `docker/production/`. Each environment has its own `.env` file and Dockerfile optimized for that tier.

---

## Testing

```bash
# Run all tests with interactive UI
npm run test

# Run tests in CI mode (no UI, exits with code)
npm run test:check

# Generate coverage report
npm run test:coverage

# Run Playwright E2E tests
npx playwright test
```

**Conventions:**
- Test files mirror source: `src/__test__/services/user.service.test.ts`
- Mock at the **adapter layer** (HTTP), never at the service layer
- Use `@testing-library/react` for components — test behavior, not implementation
- Use **MSW v2** to intercept network requests in integration tests

---

## Quality Gates

Every commit is automatically validated by Husky:

1. **Biome** — format + lint check (fast, one tool)
2. **ESLint** — Next.js rules + custom architectural rules (no `console.log`, no `any`, no adapter imports in components)
3. **TypeScript** — `tsc --noEmit` — zero type errors
4. **commitlint** — enforces `type(scope): description` commit format
5. **Branch validation** — enforces `feat/`, `fix/`, `refactor/`, `hotfix/`, `docs/`, `chore/` prefixes

**Commit format:**
```
feat(auth): add JWT refresh token rotation
fix(api): handle rate limit 429 response
refactor(user): extract validation to service layer
```

---

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` before opening a pull request.

1. Fork the repository
2. Create a branch: `feat/your-feature-name`
3. Follow the patterns in `src/__examples__/`
4. Ensure all quality gates pass: `npm run type-check && npm run lint && npm run test:check`
5. Open a PR against `main`

---

## License

MIT — built by [Noah Duong](https://github.com/truongdn-it).

Use it in personal projects, commercial products, and internal tooling without restriction.
