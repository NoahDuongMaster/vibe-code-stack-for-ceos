# Landing Feature-Sliced Design Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/landing` to canonical Feature-Sliced Design v2.1 without changing its routes, rendered content, zero-JavaScript default, SEO behavior, or Cloudflare deployment target.

**Architecture:** Keep Astro's filesystem router in `apps/landing/astro/pages`, outside the checked FSD root, and keep application code in `apps/landing/src`. Use the downward dependency rule `app → pages → widgets → shared`; omit `features` and `entities` because this static marketing site currently has no reusable user interaction or domain entity. Keep app-wide infrastructure in `app`, whole route views in `pages`, independent marketing sections and the reusable site shell in `widgets`, and site-wide constants in `shared`.

**Tech Stack:** Astro 7, TypeScript 6 strict, static HTML/CSS, ESLint 9, Steiger 0.5.13, `@feature-sliced/steiger-plugin` 0.6.0, Cloudflare Workers static assets.

---

## Design evidence and current baseline

- FSD v2.1 defines the ordered layers `app`, `pages`, `widgets`, `features`, `entities`, and `shared`; modules may import only slices on lower layers: <https://feature-sliced.design/docs/reference/layers>.
- FSD defines `features` as important user interactions, while `widgets` are large self-sufficient UI blocks. Static sections named “features” in product copy are not automatically slices in the FSD `features` layer.
- FSD requires every slice and every App/Shared segment to expose a public API. It standardizes purpose-based segment names such as `ui`, `model`, and `config`, and explicitly rejects essence-based names such as `components`: <https://feature-sliced.design/docs/reference/slices-segments>.
- Astro supports moving its source directory with `srcDir`, so framework-owned route entrypoints can live outside the FSD root. Astro also resolves aliases declared in `tsconfig.json`: <https://docs.astro.build/en/reference/configuration-reference/#srcdir> and <https://docs.astro.build/en/guides/imports/#aliases>.
- The current architecture check reports eight errors:

```bash
pnpm --package=steiger@0.5.13 \
  --package=@feature-sliced/steiger-plugin@0.6.0 \
  dlx steiger apps/landing/src
```

Expected current result: FAIL with `fsd/no-layer-public-api`, three `fsd/no-segmentless-slices`, three `fsd/public-api`, and one `fsd/segments-by-purpose` violation.

## Target file map

```text
apps/landing/
  astro/
    pages/
      404.astro                     Astro route wrapper only
      index.astro                   Astro route wrapper only
      robots.txt.ts                 delegates response creation to app/seo
  src/
    app/
      seo/
        create-robots-response.ts   app-wide crawler policy
        index.ts                    public API
      styles/
        global.css                  app-wide tokens and base styles
        index.ts                    side-effect public API
    pages/
      home/
        ui/home-page.astro          composes home widgets
        index.ts                    public API
      not-found/
        ui/not-found-page.astro     complete 404 view
        index.ts                    public API
    widgets/
      feature-overview/
        model/feature-overview.ts   typed static marketing content
        ui/feature-overview.astro   feature-card section
        index.ts                    public API
      marketing-hero/
        ui/marketing-hero.astro     hero section
        index.ts                    public API
      site-shell/
        ui/site-shell.astro         document shell
        ui/site-header.astro        private site navigation
        ui/site-footer.astro        private site footer
        index.ts                    public API
      tech-stack/
        model/tech-stack.ts         typed static stack content
        ui/tech-stack.astro         stack section
        index.ts                    public API
    shared/
      config/
        site.ts                     identity, navigation, external URLs
        index.ts                    public API
```

`features/` and `entities/` are intentionally absent. Add them only when the site gains reusable user interactions (for example, newsletter subscription) or product-domain entities, respectively.

### Task 1: Add a failing FSD architecture gate

**Files:**
- Create: `apps/landing/steiger.config.ts`
- Modify: `apps/landing/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add Steiger to the landing workspace**

Run:

```bash
pnpm --filter @apps/landing add -D steiger@0.5.13 @feature-sliced/steiger-plugin@0.6.0
```

Expected: `apps/landing/package.json` contains both exact dev dependency versions and `pnpm-lock.yaml` remains valid.

- [ ] **Step 2: Create the architecture configuration**

Create `apps/landing/steiger.config.ts`:

```typescript
import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/**/*.d.ts'],
  },
  {
    files: [
      './src/pages/**',
      './src/widgets/feature-overview/**',
      './src/widgets/marketing-hero/**',
      './src/widgets/site-shell/**',
      './src/widgets/tech-stack/**',
    ],
    rules: {
      // Astro route wrappers live outside the FSD root. The home-only widgets
      // are independent page blocks, so a single in-root consumer is valid.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
```

- [ ] **Step 3: Wire the check into landing lint**

Set the landing scripts to:

```json
{
  "lint": "eslint astro src && pnpm lint:architecture",
  "lint:architecture": "steiger ./src --fail-on-warnings"
}
```

- [ ] **Step 4: Run the architecture check and verify it fails**

Run:

```bash
pnpm --filter @apps/landing lint:architecture
```

Expected: FAIL with the current eight FSD violations. This is the red architecture test that the migration must make green.

### Task 2: Separate Astro entrypoints from the FSD root

**Files:**
- Move: `apps/landing/src/pages/index.astro` → `apps/landing/astro/pages/index.astro`
- Move: `apps/landing/src/pages/404.astro` → `apps/landing/astro/pages/404.astro`
- Move: `apps/landing/src/pages/robots.txt.ts` → `apps/landing/astro/pages/robots.txt.ts`
- Modify: `apps/landing/astro.config.mjs`
- Modify: `apps/landing/tsconfig.json`

- [ ] **Step 1: Point Astro at its framework entrypoint directory**

Add `srcDir` beside `site` in `astro.config.mjs`:

```javascript
export default defineConfig({
  srcDir: './astro',
  site: process.env.PUBLIC_SITE_URL ?? 'https://landing.workers.dev',
  integrations,
});
```

- [ ] **Step 2: Add the FSD import alias**

Replace `apps/landing/tsconfig.json` with:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "astro/**/*", "src/**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 3: Make all Astro routes thin wrappers**

Create `astro/pages/index.astro`:

```astro
---
import { SiteShell } from '@/widgets/site-shell';
import { HomePage } from '@/pages/home';
import '@/app/styles';
---

<SiteShell title="AI-First Monorepo Boilerplate">
  <HomePage />
</SiteShell>
```

Create `astro/pages/404.astro`:

```astro
---
import { SiteShell } from '@/widgets/site-shell';
import { NotFoundPage } from '@/pages/not-found';
import '@/app/styles';
---

<SiteShell
  title="404 — Page not found · AI-First Monorepo Boilerplate"
  description="The page you are looking for does not exist or has moved."
>
  <NotFoundPage />
</SiteShell>
```

Create `astro/pages/robots.txt.ts`:

```typescript
import { createRobotsResponse } from '@/app/seo';

export const GET: import('astro').APIRoute = ({ site }) =>
  createRobotsResponse(site);
```

- [ ] **Step 4: Confirm the wrapper imports fail before creating FSD public APIs**

Run:

```bash
pnpm --filter @apps/landing typecheck
```

Expected: FAIL because `@/app/styles`, `@/app/seo`, the page slice Public APIs,
and `@/widgets/site-shell` do not exist yet.

### Task 3: Build the App, Pages, Widgets, and Shared layers

**Files:**
- Create: all files under the target `src/app`, `src/pages`, `src/widgets`, and `src/shared` tree
- Delete after moving content: `apps/landing/src/features/**`
- Delete after moving content: `apps/landing/src/shared/components/**`
- Delete after moving content: `apps/landing/src/shared/data/**`
- Delete after moving content: `apps/landing/src/shared/layouts/**`
- Delete after moving content: `apps/landing/src/styles/**`

- [ ] **Step 1: Create Shared config and its public API**

Create `src/shared/config/site.ts`:

```typescript
export interface TNavLink {
  href: string;
  label: string;
}

export const SITE = {
  name: 'AI-First Next.js Boilerplate',
  shortName: 'AI-First',
  locale: 'en_US',
  description:
    'AI-first monorepo boilerplate — type-safe, edge-ready, built for micro-frontends and microservices.',
  ogImage: '/favicon.svg',
} as const;

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#stack', label: 'Stack' },
] as const satisfies readonly TNavLink[];

export const SOCIAL_LINKS = {
  github: 'https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos',
} as const;
```

Create `src/shared/config/index.ts`:

```typescript
export { NAV_LINKS, SITE, SOCIAL_LINKS } from './site';
export type { TNavLink } from './site';
```

- [ ] **Step 2: Create the app-wide style public API**

Move `src/styles/global.css` unchanged to `src/app/styles/global.css`, then create `src/app/styles/index.ts`:

```typescript
import './global.css';
```

- [ ] **Step 3: Move the app-wide crawler policy behind a public API**

Create `src/app/seo/create-robots-response.ts`:

```typescript
export const createRobotsResponse = (site: URL | undefined): Response => {
  const isStaging = site?.hostname.includes('staging') ?? false;

  const body = isStaging
    ? 'User-agent: *\nDisallow: /\n'
    : [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', site).href}`,
        '',
      ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

Create `src/app/seo/index.ts`:

```typescript
export { createRobotsResponse } from './create-robots-response';
```

- [ ] **Step 4: Prepare the private site chrome for the shell widget**

Move `shared/components/Nav.astro` to `widgets/site-shell/ui/site-header.astro`, update its Shared import to:

```astro
---
import { NAV_LINKS, SITE, SOCIAL_LINKS } from '@/shared/config';
---
```

Keep its template and scoped styles unchanged. Move `shared/components/Footer.astro` to `widgets/site-shell/ui/site-footer.astro`, update its Shared import to:

```astro
---
import { SITE } from '@/shared/config';

const year = new Date().getFullYear();
---
```

Keep its template and scoped styles unchanged. These files remain private to the
`site-shell` slice and are not exported through its Public API.

- [ ] **Step 5: Create the marketing hero widget**

Move `features/hero/Hero.astro` to `widgets/marketing-hero/ui/marketing-hero.astro`, change its import to:

```astro
---
import { SOCIAL_LINKS } from '@/shared/config';
---
```

Keep the rendered markup and scoped styles unchanged. Create `widgets/marketing-hero/index.ts`:

```typescript
export { default as MarketingHero } from './ui/marketing-hero.astro';
```

- [ ] **Step 6: Create the feature overview widget**

Move `features/feature-grid/feature-grid.data.ts` to `widgets/feature-overview/model/feature-overview.ts`, rename `Feature` to `TFeature`, and preserve the six data items:

```typescript
export interface TFeature {
  icon: string;
  title: string;
  body: string;
}

export const FEATURES = [
  {
    icon: '🧩',
    title: 'Micro-frontends',
    body: 'Next.js app + Astro landing as independent workspaces, shipped from one repo.',
  },
  {
    icon: '🔌',
    title: 'Connect RPC',
    body: 'Protobuf contract, gRPC-compatible — the server’s types flow straight into the frontend.',
  },
  {
    icon: '⚡',
    title: 'Edge-native',
    body: 'Cloudflare Workers + Vite for the app and services; static assets for the landing.',
  },
  {
    icon: '🧱',
    title: 'Turborepo',
    body: 'Cached build / typecheck / lint pipeline across apps, services, and shared packages.',
  },
  {
    icon: '🛡️',
    title: 'Type-safe contracts',
    body: 'Zod schemas in one package, shared by frontend and backend — zero drift.',
  },
  {
    icon: '🎨',
    title: 'Panda CSS + Ark UI',
    body: 'Accessible, themeable design system in the app; fast static styling here.',
  },
] as const satisfies readonly TFeature[];
```

Move `features/feature-grid/FeatureGrid.astro` to `widgets/feature-overview/ui/feature-overview.astro`, change only its local import:

```astro
---
import { FEATURES } from '../model/feature-overview';
---
```

Keep the rendered markup and scoped styles unchanged. Create `widgets/feature-overview/index.ts`:

```typescript
export { default as FeatureOverview } from './ui/feature-overview.astro';
```

- [ ] **Step 7: Create the tech stack widget**

Move `features/tech-stack/tech-stack.data.ts` to `widgets/tech-stack/model/tech-stack.ts` unchanged. Move `features/tech-stack/TechStack.astro` to `widgets/tech-stack/ui/tech-stack.astro` and update its import:

```astro
---
import { STACK } from '../model/tech-stack';
---
```

Keep the rendered markup and scoped styles unchanged. Create `widgets/tech-stack/index.ts`:

```typescript
export { default as TechStack } from './ui/tech-stack.astro';
```

- [ ] **Step 8: Create the page slices and public APIs**

Create `src/pages/home/ui/home-page.astro`:

```astro
---
import { FeatureOverview } from '@/widgets/feature-overview';
import { MarketingHero } from '@/widgets/marketing-hero';
import { TechStack } from '@/widgets/tech-stack';
---

<main id="main-content">
  <MarketingHero />
  <FeatureOverview />
  <TechStack />
</main>
```

Create `src/pages/home/index.ts`:

```typescript
export { default as HomePage } from './ui/home-page.astro';
```

Move the `<main>` markup and scoped styles from the old `pages/404.astro` into `src/pages/not-found/ui/not-found-page.astro` without the old layout, header, or footer imports. Create `src/pages/not-found/index.ts`:

```typescript
export { default as NotFoundPage } from './ui/not-found-page.astro';
```

- [ ] **Step 9: Create the site shell widget**

Move `shared/layouts/Layout.astro` to `src/widgets/site-shell/ui/site-shell.astro`. Replace its imports with:

```astro
---
import { SITE } from '@/shared/config';
import SiteFooter from './site-footer.astro';
import SiteHeader from './site-header.astro';
```

Keep the existing props, metadata, structured data, document markup, and skip-link styles. Replace the body slot area with:

```astro
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <SiteHeader />
  <slot />
  <SiteFooter />
</body>
```

Create `src/widgets/site-shell/index.ts`:

```typescript
export { default as SiteShell } from './site-shell.astro';
```

- [ ] **Step 10: Remove the obsolete pseudo-FSD directories**

Delete the now-empty or superseded paths:

```text
apps/landing/src/features
apps/landing/src/shared/components
apps/landing/src/shared/data
apps/landing/src/shared/layouts
apps/landing/src/styles
```

- [ ] **Step 11: Run the focused green checks**

Run:

```bash
pnpm --filter @apps/landing lint:architecture
pnpm --filter @apps/landing typecheck
pnpm --filter @apps/landing lint
pnpm --filter @apps/landing build
```

Expected: all commands exit 0; the build still emits `/index.html`, `/404.html`, `/robots.txt`, and no client-side JavaScript when `PUBLIC_SENTRY_DSN` is unset.

### Task 4: Make canonical Landing FSD the repository rule

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Correct architecture scope**

Document that the existing custom feature-slice rules remain scoped to `apps/dapp` and `apps/admin`, while canonical FSD v2.1 applies to `apps/landing`.

- [ ] **Step 2: Add the Landing FSD contract**

Add a dedicated architecture subsection containing these enforceable rules:

```markdown
### Landing architecture — canonical Feature-Sliced Design v2.1

`apps/landing` uses Astro route entrypoints in `astro/pages/` and canonical FSD
application code in `src/`. Its current layers are `app → pages → widgets →
shared`; `features` and `entities` are intentionally absent until the product
has reusable user interactions or domain entities.

1. Imports point downward only. Slices on the same layer never import each other.
2. Every slice and every `app`/`shared` segment exposes an `index.ts` Public API;
   external consumers never deep-import internals.
3. Segment names describe purpose (`ui`, `model`, `config`, `seo`, `styles`),
   never file essence (`components`, `hooks`, `types`, `data`).
4. `astro/pages/` contains thin framework entrypoints only. Page composition
   lives in `src/pages/[name]`; independent page blocks live in `src/widgets`.
5. A static section describing product features is a widget, not an FSD feature.
   Add an FSD feature only for a reusable user interaction that provides value.
6. Run `pnpm --filter @apps/landing lint:architecture` after structural changes.
```

- [ ] **Step 3: Document the Astro component export exception**

Amend the default-export naming rule to state that `.astro` components are also allowed to use their framework-native default export, while TypeScript/TSX modules retain the existing restriction.

- [ ] **Step 4: Verify the documentation matches the actual tree**

Run:

```bash
rg -n "apps/landing|canonical Feature-Sliced|lint:architecture|\.astro" AGENTS.md
find apps/landing/src -maxdepth 4 -type f | sort
```

Expected: the documented tree and rules match the migrated source exactly; no nested `AGENTS.md` exists.

### Task 5: Run the repository definition-of-done gates

**Files:**
- No source changes expected

- [ ] **Step 1: Run all required CI-equivalent checks**

Run sequentially so each failure is attributable:

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
```

Expected: all five commands exit 0. If a failure is in an unrelated pre-existing dirty-worktree file, record the exact command and failing path rather than changing unrelated user work.

- [ ] **Step 2: Check the landing output contract**

Run:

```bash
test -f apps/landing/dist/index.html
test -f apps/landing/dist/404.html
test -f apps/landing/dist/robots.txt
find apps/landing/dist -type f -name '*.js' -print
rg -n "AI-first products|Everything wired|The stack|Page not found" \
  apps/landing/dist/index.html apps/landing/dist/404.html
```

Expected: the three route outputs exist, the JavaScript search prints nothing when Sentry is disabled, and the visible content remains present in the built HTML.

## Self-review

- **Spec coverage:** The plan fixes layer semantics, route/FSD collision, Public APIs, purpose-based segments, naming, enforcement, repository documentation, and zero-JS/build preservation.
- **YAGNI:** No empty `features` or `entities` directories are created. No runtime dependency, island, or client script is introduced.
- **Change safety:** Route URLs, HTML copy, scoped CSS, SEO metadata, sitemap integration, staging robots policy, public assets, and Cloudflare configuration remain unchanged.
- **Type consistency:** Public exports and route imports use the same names: `SiteShell`, `HomePage`, `NotFoundPage`, `MarketingHero`, `FeatureOverview`, and `TechStack`. `SiteHeader` and `SiteFooter` remain private to the `site-shell` slice.
