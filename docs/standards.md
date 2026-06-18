# International Standards & Scientific References

Every technical decision in this boilerplate is grounded in a published standard,
RFC, or peer-reviewed best practice. This document lists them with the corresponding
location in the codebase.

---

## Security

| Standard | What it covers | Where applied |
|----------|----------------|---------------|
| **OWASP Top 10 (2021)** | Web application security risks | `SECURITY.md`, `next.config.ts` CSP headers |
| **OWASP A01:2021 — Broken Access Control** | Path traversal, privilege escalation | `src/middleware.ts` (CWE-22 block) |
| **OWASP A02:2021 — Cryptographic Failures** | Encrypted session cookies | `src/lib/session.ts` (iron-session AES-256-GCM) |
| **OWASP A03:2021 — Injection** | XSS, command injection prevention | `src/utils/sanitize.helper.ts` |
| **OWASP A05:2021 — Security Misconfiguration** | HTTP security headers | `next.config.ts` (CSP, HSTS, X-Frame-Options) |
| **CWE-22 Path Traversal** | Directory traversal via `../` | `src/middleware.ts` |
| **CWE-79 XSS** | Cross-site scripting | CSP `script-src 'self'` in `next.config.ts` |
| **RFC 9116** | `security.txt` responsible disclosure | `public/.well-known/security.txt` |
| **HSTS (RFC 6797)** | HTTP Strict Transport Security | `next.config.ts` `Strict-Transport-Security` header |
| **Content Security Policy Level 3 (W3C)** | XSS mitigation via HTTP headers | `next.config.ts` |

---

## API Design

| Standard | What it covers | Where applied |
|----------|----------------|---------------|
| **RFC 9457 / RFC 7807** | Problem Details for HTTP APIs | `src/app/api/health/route.ts` (`application/health+json`) |
| **Health Check Response Format (IETF draft-inadarei)** | Standardized `/health` response schema | `src/app/api/health/route.ts` |
| **REST Architectural Constraints (Fielding, 2000)** | Stateless, uniform interface | `src/adapters/xhr.ts` + layered architecture |
| **HTTP/1.1 Semantics (RFC 9110)** | Correct use of status codes, headers | All `src/app/api/` route handlers |
| **JSON:API (jsonapi.org)** | Consistent API response envelopes | `src/types/api.types.ts` `TPaginatedResponse<T>` |

---

## Accessibility

| Standard | What it covers | Where applied |
|----------|----------------|---------------|
| **WCAG 2.1 AA (W3C)** | Web Content Accessibility Guidelines | Ark UI v5 (`@ark-ui/react`) — all primitives are WAI-ARIA compliant |
| **WAI-ARIA 1.2 (W3C)** | Accessible Rich Internet Applications | Ark UI headless components enforce correct ARIA roles |
| **APG (ARIA Authoring Practices Guide)** | Keyboard navigation patterns | Ark UI implements APG patterns (dialog, menu, combobox) |

---

## Architecture

| Standard / Pattern | What it covers | Where applied |
|-------------------|----------------|---------------|
| **Clean Architecture (R. Martin, 2017)** | Dependency rule: outer layers depend on inner | `app → services → adapters` strict layering in `CLAUDE.md` |
| **Hexagonal Architecture / Ports & Adapters (Cockburn, 2005)** | Isolate business logic from I/O | `src/adapters/` (ports) wrapping external APIs |
| **Domain-Driven Design — Layered Architecture (Evans, 2003)** | Separate concerns by domain | `src/services/` (domain) + `src/adapters/` (infrastructure) |
| **SOLID Principles (Martin, 2000)** | Single responsibility, open/closed | One function per endpoint in adapters; services compose adapters |

---

## TypeScript & JavaScript

| Standard | What it covers | Where applied |
|----------|----------------|---------------|
| **ECMAScript 2024 (ECMA-262)** | Language specification | TypeScript target `ES2022+` in `tsconfig.json` |
| **TypeScript Strict Mode** | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | `tsconfig.json` `strict: true` |
| **Zod v4 schema-first typing** | Runtime validation + static type inference | All `*.schema.ts` files; types via `z.infer<>` |

---

## Testing

| Standard / Principle | What it covers | Where applied |
|---------------------|----------------|---------------|
| **FIRST Principles (Meszaros, 2007)** | Fast, Isolated, Repeatable, Self-validating, Timely | `src/__test__/` — unit tests mock only the HTTP layer |
| **Testing Trophy (Dodds, 2019)** | Integration > Unit > E2E prioritisation | MSW for integration, Vitest for unit, Playwright for E2E |
| **Black-box testing** | Test behaviour, not implementation | `@testing-library/react` — no internal state assertions |
| **Contract testing via MSW** | Network-layer mocking (not service mocking) | `src/__test__/mocks/handlers.ts` — matches API contract |

---

## Git & Collaboration

| Standard | What it covers | Where applied |
|----------|----------------|---------------|
| **Conventional Commits 1.0.0** | Structured commit messages | `commitlint.config.ts` + `.husky/commit-msg` |
| **Semantic Versioning 2.0.0 (semver.org)** | Version numbering | `package.json` + `CHANGELOG.md` |
| **Keep a Changelog 1.1.0** | Human-readable changelog format | `CHANGELOG.md` |
| **GitHub Flow** | Branch-based lightweight workflow | `.github/workflows/` + branch protection rules |

---

## Performance

| Standard | What it covers | Where applied |
|----------|----------------|---------------|
| **Core Web Vitals (Google, 2020)** | LCP, INP, CLS metrics | `@vercel/analytics` + `@vercel/speed-insights` in `layout.tsx` |
| **react-scan (Airlangga, 2024)** | Runtime re-render detection | `src/components/features/devtools.tsx` (dev-only) |
| **Turbopack (Vercel, 2022)** | Incremental bundler, Rust-based | `next dev --turbo` in `package.json` |

---

## UI & Styling

| Standard | What it covers | Where applied |
|----------|----------------|---------------|
| **OKLCH Color Space (CIE, 1976 / CSS Color 4 W3C)** | Perceptually uniform, gamut-safe colors | Tailwind CSS v4 theme in `src/styles/global.style.css` |
| **CSS Cascade Layers (W3C)** | Predictable style specificity | Tailwind v4 `@layer` directives |
| **WAI-ARIA Design Patterns** | Accessible component behavior | Ark UI implements Dialog, Menu, Select, Combobox patterns |

---

> **How to add a new standard**: when introducing a new pattern, library, or security
> control, add a row to the relevant table with the standard's full citation and the
> file(s) where it is applied.
