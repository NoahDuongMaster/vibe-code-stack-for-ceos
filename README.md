<div align="center">

<img src="public/og-image.png" alt="AI-First Next.js Boilerplate" width="100%" />

<br />
<br />

# AI-First Next.js Boilerplate

### Stop prompting. Start shipping.

The **only** Next.js boilerplate where Claude Code, Cursor, Gemini CLI, Kiro, Copilot, and Windsurf all produce **identical, production-grade code** — without custom prompting.

[![GitHub stars](https://img.shields.io/github/stars/NoahDuongMaster/ai-first-nextjs-boilerplate?style=for-the-badge&logo=github&color=yellow)](https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/NoahDuongMaster/ai-first-nextjs-boilerplate?style=for-the-badge&logo=github&color=blue)](https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate/network/members)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](https://opensource.org/licenses/MIT)

[Get Started](#-quick-start) · [Why This Exists](#-the-problem) · [Features](#-what-you-get) · [Star History](#-star-history)

</div>

---

## The Problem

You open Cursor, type "create a user profile page," and get:
- A file in the wrong folder
- `useState` for form fields instead of react-hook-form
- Raw `fetch()` instead of your HTTP client
- `console.log` everywhere
- No Zod validation, no error boundaries, no types

**You spend more time fixing AI output than writing code yourself.**

This boilerplate solves that. Every AI tool reads the same rules, follows the same architecture, and produces code that passes your linting, type-checking, and code review — on the first try.

---

## Why Developers Are Switching

<table>
<tr>
<th width="250"></th>
<th width="150" align="center"><code>create-next-app</code></th>
<th width="150" align="center"><code>t3-app</code></th>
<th width="200" align="center"><b>AI-First Boilerplate</b></th>
</tr>
<tr>
<td><b>AI understands your architecture</b></td>
<td align="center">-</td>
<td align="center">-</td>
<td align="center">6 AI configs, synced</td>
</tr>
<tr>
<td><b>Vertical slice architecture</b></td>
<td align="center">-</td>
<td align="center">Partial</td>
<td align="center">Strict, ESLint-enforced</td>
</tr>
<tr>
<td><b>Pre-commit AI code review</b></td>
<td align="center">-</td>
<td align="center">-</td>
<td align="center">Code Review Graph MCP</td>
</tr>
<tr>
<td><b>Type-safe server actions</b></td>
<td align="center">-</td>
<td align="center">-</td>
<td align="center">next-safe-action v8</td>
</tr>
<tr>
<td><b>Headless, accessible UI</b></td>
<td align="center">-</td>
<td align="center">-</td>
<td align="center">Ark UI v5 (WAI-ARIA)</td>
</tr>
<tr>
<td><b>Canonical AI examples</b></td>
<td align="center">-</td>
<td align="center">-</td>
<td align="center"><code>src/__examples__/</code></td>
</tr>
<tr>
<td><b>Docker (dev/staging/prod)</b></td>
<td align="center">-</td>
<td align="center">-</td>
<td align="center">Three-tier setup</td>
</tr>
<tr>
<td><b>Security headers (CSP/HSTS)</b></td>
<td align="center">-</td>
<td align="center">-</td>
<td align="center">OWASP-ready</td>
</tr>
</table>

---

## What You Get

### AI-First Development — *The Core Differentiator*

> **One rule file. Six AI tools. Zero drift.**

Every AI coding assistant in your team reads **the same architecture rules** from a single source (`.ai/rules.md`), auto-synced to each tool's config format:

| AI Tool | Config | Status |
|---------|--------|--------|
| **Claude Code** | `CLAUDE.md` + `.claude/steering/` | Fully configured |
| **Cursor** | `.cursorrules` | Fully configured |
| **Windsurf** | `.windsurfrules` | Fully configured |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Fully configured |
| **Gemini CLI** | `.gemini/GEMINI.md` + hooks | Fully configured |
| **Kiro** | `.kiro/steering/` | Fully configured |

**What this means in practice:** Two developers — one using Cursor, one using Claude Code — generate code that looks like it was written by the same person. No "fix the AI output" phase. No style wars. No architectural drift.

<details>
<summary><b>Pre-commit AI Code Review (Code Review Graph MCP)</b></summary>

Every commit triggers a **semantic impact analysis** powered by a Tree-sitter knowledge graph:
- Detects which functions, components, and modules are affected
- Scores risk level of changes
- Flags architectural violations before they reach PR review
- Provides blast radius visualization

This isn't linting — it's structural understanding of your codebase.

</details>

---

### Production-Grade Architecture

```
src/
  app/              Routes ONLY — pages, layouts, route handlers
  features/         Vertical slices — one folder per business domain
    [name]/
      _components/  Private UI (never imported outside feature)
      _hooks/       Private hooks
      adapters/     HTTP layer (calls shared/lib/xhr)
      schemas/      Zod schemas + derived types
      services/     Business logic
      actions/      next-safe-action server actions
      index.ts      PUBLIC barrel — the ONLY export surface
  shared/           Cross-cutting utilities
  server/           Server-only code (iron-session, etc.)
```

**Hard rules enforced by ESLint:**
- `app/` imports ONLY from `features/[name]/index.ts` — never deep paths
- Features NEVER import from other features
- `shared/` NEVER imports from `features/` or `app/`
- Adapters use `shared/lib/xhr.ts` — never raw `fetch()`

---

### Full-Stack Tech Stack

<table>
<tr><td><b>Framework</b></td><td>Next.js 16 (App Router + Turbopack)</td></tr>
<tr><td><b>Language</b></td><td>TypeScript 6 (strict mode)</td></tr>
<tr><td><b>Styling</b></td><td>Panda CSS + Ark UI v5 (headless, WAI-ARIA)</td></tr>
<tr><td><b>Server State</b></td><td>TanStack Query v5</td></tr>
<tr><td><b>Client State</b></td><td>Zustand v5 + nuqs (URL state)</td></tr>
<tr><td><b>Forms</b></td><td>react-hook-form + Zod v4</td></tr>
<tr><td><b>Server Actions</b></td><td>next-safe-action v8 (end-to-end typed)</td></tr>
<tr><td><b>Tables</b></td><td>TanStack Table v8</td></tr>
<tr><td><b>HTTP</b></td><td>ofetch v1 (browser + Edge + SSR)</td></tr>
<tr><td><b>Auth</b></td><td>iron-session v8 (encrypted cookies)</td></tr>
<tr><td><b>Animations</b></td><td>Motion (Framer Motion v12)</td></tr>
<tr><td><b>Testing</b></td><td>Vitest v4 + Testing Library + Playwright</td></tr>
<tr><td><b>Linting</b></td><td>Biome v2 + ESLint (architectural rules)</td></tr>
<tr><td><b>Monitoring</b></td><td>Sentry (error tracking + performance)</td></tr>
<tr><td><b>CI/CD</b></td><td>GitHub Actions (lint → type-check → test → build)</td></tr>
<tr><td><b>Containers</b></td><td>Docker (dev / staging / prod)</td></tr>
</table>

---

### Security — Not an Afterthought

- CSP, HSTS, X-Frame-Options, X-Content-Type-Options configured out of the box
- `import 'server-only'` guard on server modules
- Zod validation at every API boundary
- Middleware-based route protection
- `public/.well-known/security.txt` for responsible disclosure
- No `eval()`, no `dangerouslySetInnerHTML` without DOMPurify

---

### Testing — Mock Adapters, Never Services

```bash
npm run test          # Vitest with interactive UI
npm run test:check    # CI mode (exits with code)
npm run test:coverage # Coverage report (v8)
npx playwright test   # E2E tests
```

- Mock at the HTTP layer (adapters), never at the service layer
- `@testing-library/react` for behavior-driven component tests
- MSW v2 for network-level API mocking
- Convention: `describe('[ServiceName]') > it('should [behavior] when [condition]')`

---

### Quality Gates — Every Commit

Husky runs automatically on every commit:

1. **Biome** — format + lint (sub-second)
2. **ESLint** — architectural rules (no `console.log`, no `any`, no cross-feature imports)
3. **TypeScript** — `tsc --noEmit`, zero errors
4. **commitlint** — enforces `type(scope): description` format
5. **Code Review Graph** — semantic impact analysis

> If it doesn't pass the gates, it doesn't get committed. Period.

---

## Quick Start

```bash
# Clone
git clone https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate.git
cd ai-first-nextjs-boilerplate

# Install
npm install

# Start dev server (Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

<details>
<summary><b>Sync AI configs after editing rules</b></summary>

All AI tool configs are generated from a single source (`.ai/rules.md`):

```bash
./scripts/gen-ai-config.sh
```

This updates `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, `.gemini/GEMINI.md`, and `.kiro/steering/` — keeping every AI tool in sync.

</details>

<details>
<summary><b>Docker environments</b></summary>

```bash
# Development (hot-reload, source maps)
npm run build:development && npm run start:development  # → :3001

# Staging (production build, staging env)
npm run build:staging && npm run start:staging          # → :3002

# Production (standalone, minimal image)
npm run build:production && npm run start:production    # → :80
```

</details>

<details>
<summary><b>Environment variables</b></summary>

Declared in `src/shared/config/env.configuration.ts` with Zod validation. Never use `process.env` directly.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Public base URL |
| `SESSION_SECRET` | Yes | iron-session secret (32+ chars) |
| `NEXT_PUBLIC_API_URL` | Yes | External API base URL |

</details>

---

## All Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run type-check` | TypeScript check (zero errors) |
| `npm run lint` | ESLint + architectural rules |
| `npm run lint:biome` | Biome check + auto-fix |
| `npm run format` | Biome format all files |
| `npm run test` | Vitest with UI |
| `npm run test:check` | Vitest CI mode |
| `npm run test:coverage` | Coverage report |
| `npm run build:development` | Docker build (dev) |
| `npm run build:staging` | Docker build (staging) |
| `npm run build:production` | Docker build (prod) |

---

## Project Structure

```
.
├── .ai/rules.md                  Single source of truth for all AI rules
├── .claude/steering/             Claude Code steering rules
├── .cursorrules                  Cursor rules (auto-synced)
├── .windsurfrules                Windsurf rules (auto-synced)
├── .github/copilot-instructions  Copilot rules (auto-synced)
├── .gemini/                      Gemini CLI config + hooks
├── .kiro/steering/               Kiro steering rules
├── docker/                       Three-tier Docker setup
├── scripts/                      AI config sync + setup scripts
├── src/
│   ├── app/                      Next.js routes (zero business logic)
│   ├── features/                 Vertical slices by domain
│   ├── shared/                   Cross-cutting utilities
│   ├── server/                   Server-only code
│   └── __examples__/             Canonical patterns for AI reference
└── tests/                        Playwright E2E tests
```

---

## Contributing

1. Fork the repo
2. Create a branch: `feat(scope)/issue-123-description`
3. Follow patterns in `src/__examples__/`
4. Pass all gates: `npm run type-check && npm run lint && npm run test:check`
5. Open a PR

---

## Star History

<a href="https://star-history.com/#NoahDuongMaster/ai-first-nextjs-boilerplate&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=NoahDuongMaster/ai-first-nextjs-boilerplate&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=NoahDuongMaster/ai-first-nextjs-boilerplate&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=NoahDuongMaster/ai-first-nextjs-boilerplate&type=Date" />
 </picture>
</a>

---

<div align="center">

**If this saved you time, [star the repo](https://github.com/NoahDuongMaster/ai-first-nextjs-boilerplate) — it helps others find it.**

Built by [Noah Duong](https://github.com/NoahDuongMaster) · MIT License

<a href="https://buymeacoffee.com/truongdn"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" /></a>
<a href="https://github.com/sponsors/truongdn-it"><img src="https://img.shields.io/badge/Sponsor-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white" /></a>

</div>
