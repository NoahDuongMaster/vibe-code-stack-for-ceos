# Dapp Crypto Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the executing-plans workflow to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dapp boilerplate home page with a public USD crypto dashboard that uses typed ConnectRPC market data through API Gateway and renders an accessible React Three Fiber WebGL scene.

**Architecture:** `HomePage` remains a Server Component and delegates to a narrow client dashboard. The dashboard loads a semantically validated ten-asset snapshot through a configured `@packages/api-client` `TradingClient`, uses TanStack Query for 60-second refreshes, and feeds one page model to both semantic DOM components and a dynamically loaded WebGL scene. API Gateway uses separate auth-public and rate-limit-exempt path policies so `GetMarkets` is public but still rate limited.

**Tech Stack:** Next.js 16 on vinext 0.1, React 19.2, TypeScript 6 strict, ConnectRPC 2, TanStack Query 5, Zod 4, Panda CSS 1, Three.js 0.185.1, React Three Fiber 9.6.1, Drei 10.7.7, Vitest 4, Testing Library, Playwright.

## Global Constraints

- The dashboard is public, read-only, mounted at `/`, and replaces the current boilerplate home page.
- Request exactly `bitcoin`, `ethereum`, `tether`, `binancecoin`, `solana`, `ripple`, `usd-coin`, `dogecoin`, `cardano`, and `avalanche-2`, quoted in `usd`.
- Use `createTradingClient`; do not call `fetch`, axios, or hardcode the Connect RPC path in dapp production code.
- Keep market code in `_pages/home/{api,model,ui}` until a real second consumer justifies an Entity, Feature, or Widget.
- `HomePage` remains a Server Component. Put `'use client'` only on dashboard/WebGL boundaries.
- Validate gateway responses semantically with Zod 4 before rendering them.
- Market data bypasses gateway bearer auth but does not bypass Durable Object rate limiting.
- Health paths remain both auth-public and rate-limit-exempt.
- Load the WebGL scene client-only, cap DPR at 1.5, avoid real-time shadows, pause when offscreen/hidden, support reduced motion, and retain a static fallback.
- Essential values and controls remain semantic DOM content; the canvas is decorative enhancement.
- Components never render raw Connect/internal error messages.
- All local dapp imports use `@/`; generated code and `src/styled-system/**` are never hand-edited.
- Preserve unrelated dirty-worktree changes and never deploy locally.
- `AGENTS.md` and `pnpm-lock.yaml` were already modified before this work. Never
  stage either whole file. Leave the dashboard-specific hunks in those two files
  unstaged unless they can be isolated without including the user's prior work.

---

## File Map

### Gateway

- Modify `services/api-gateway/src/config/gateway-options.ts` — separate auth-public and rate-limit-exempt paths.
- Modify `services/api-gateway/src/index.ts` — inject distinct access policies.
- Modify `services/api-gateway/src/index.test.ts` — prove market auth/public behavior and retained limiting.

### Dapp infrastructure

- Modify `apps/dapp/package.json` and `pnpm-lock.yaml` — typed client and WebGL dependencies.
- Modify `apps/dapp/.env.sample` — local API Gateway URL.
- Modify `apps/dapp/src/shared/config/env.ts` — require a valid gateway endpoint.
- Create `apps/dapp/src/shared/api/trading-client.ts` — configured singleton client.
- Modify `apps/dapp/src/shared/api/index.ts` — Shared API public export.
- Modify `apps/dapp/src/__test__/shared/config/env.test.ts` — endpoint validation.
- Create `apps/dapp/src/__test__/shared/api/trading-client.test.ts` — configured client test.
- Modify `AGENTS.md` — ConnectRPC vs REST/BFF transport rule.

### Dapp home Page slice

- Create `apps/dapp/src/_pages/home/api/get-markets.api.ts`.
- Create `apps/dapp/src/_pages/home/model/market.constants.ts`.
- Create `apps/dapp/src/_pages/home/model/market.error.ts`.
- Create `apps/dapp/src/_pages/home/model/market.schema.ts`.
- Create `apps/dapp/src/_pages/home/model/market.mapper.ts`.
- Create `apps/dapp/src/_pages/home/model/market.formatters.ts`.
- Create `apps/dapp/src/_pages/home/model/market-scene.mapper.ts`.
- Create `apps/dapp/src/_pages/home/model/use-markets.ts`.
- Replace `apps/dapp/src/_pages/home/ui/home-page.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-dashboard.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-header.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-metrics.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-table.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-state.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-scene.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-scene-loader.tsx`.
- Create `apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx`.
- Create `apps/dapp/src/_pages/home/ui/use-market-scene-activity.ts`.
- Keep `apps/dapp/src/_pages/home/index.ts` as the only Page public API.

### Tests and metadata

- Create tests under `apps/dapp/src/__test__/_pages/home/{api,model,ui}/` mirroring the source paths.
- Create `apps/dapp/e2e/market-dashboard.test.ts`.
- Modify `apps/dapp/e2e/navigation.test.ts` and `apps/dapp/e2e/smoke.test.ts`.
- Modify `apps/dapp/src/_app/metadata/app-metadata.ts` and `apps/dapp/src/_app/metadata/manifest.ts`.

## Task 1: Separate gateway authentication and rate-limit policies

**Files:**

- Modify: `services/api-gateway/src/index.test.ts`
- Modify: `services/api-gateway/src/config/gateway-options.ts`
- Modify: `services/api-gateway/src/index.ts`

**Interfaces:**

- Consumes: `GatewayAccessPolicy`, `AuthorizeGatewayRequestUseCase`, and `EnforceRateLimitUseCase` unchanged.
- Produces: `AUTH_PUBLIC_PATHS` containing health plus `GetMarkets`; `RATE_LIMIT_EXEMPT_PATHS` containing health only.

- [ ] **Step 1: Write the failing gateway integration assertions**

In `services/api-gateway/src/index.test.ts`, replace the test that expects a
missing JWT to reject `MARKETS_URL` with:

```typescript
it('should keep market data public when auth is enabled', async () => {
  const fetchMock = vi.fn(async () => new Response('ok'));
  const res = await fetchGateway(
    rpcRequest(MARKETS_URL, { coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    {
      JWT_SECRET,
      TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher,
    },
  );

  expect(res.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledOnce();
});
```

Retain the existing test that returns `429` for `MARKETS_URL`; together the two
tests prove auth-public does not imply rate-limit-exempt. Change the valid-token
test to send an unknown protected path so protected JWT behavior remains
covered:

```typescript
const PROTECTED_URL = 'http://gateway.test/private.v1.PrivateService/Read';
```

- [ ] **Step 2: Run the gateway test and verify the market request is still unauthorized**

Run:

```bash
mise exec -- pnpm --filter @services/api-gateway exec vitest run src/index.test.ts
```

Expected: FAIL with the new public-market assertion receiving HTTP 401.

- [ ] **Step 3: Split and inject the two policies**

Set `services/api-gateway/src/config/gateway-options.ts` to expose:

```typescript
const HEALTH_PATHS = [
  '/healthz',
  '/health.v1.HealthService/Health',
] as const;

export const AUTH_PUBLIC_PATHS = [
  ...HEALTH_PATHS,
  '/trading.v1.TradingService/GetMarkets',
] as const;

export const RATE_LIMIT_EXEMPT_PATHS = HEALTH_PATHS;
```

In `services/api-gateway/src/index.ts`, replace the one shared policy with:

```typescript
const authAccessPolicy = new GatewayAccessPolicy(AUTH_PUBLIC_PATHS);
const rateLimitAccessPolicy = new GatewayAccessPolicy(
  RATE_LIMIT_EXEMPT_PATHS,
);
```

Pass `authAccessPolicy` only to `AuthorizeGatewayRequestUseCase` and
`rateLimitAccessPolicy` only to `EnforceRateLimitUseCase`.

- [ ] **Step 4: Verify gateway behavior and architecture**

Run:

```bash
mise exec -- pnpm --filter @services/api-gateway test
mise exec -- pnpm --filter @services/api-gateway typecheck
mise exec -- pnpm --filter @services/api-gateway lint:architecture
```

Expected: all commands PASS; market requests work with JWT enabled and still
return 429 when the limiter denies them.

- [ ] **Step 5: Commit the policy split**

```bash
git add services/api-gateway/src/config/gateway-options.ts services/api-gateway/src/index.ts services/api-gateway/src/index.test.ts
git commit -m "refactor(gateway): separate public and rate-limit policies"
```

## Task 2: Configure the typed ConnectRPC client and WebGL dependencies

**Files:**

- Modify: `apps/dapp/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/dapp/.env.sample`
- Modify: `apps/dapp/src/shared/config/env.ts`
- Create: `apps/dapp/src/shared/api/trading-client.ts`
- Modify: `apps/dapp/src/shared/api/index.ts`
- Modify: `apps/dapp/src/__test__/shared/config/env.test.ts`
- Create: `apps/dapp/src/__test__/shared/api/trading-client.test.ts`
- Modify: `AGENTS.md`

**Interfaces:**

- Consumes: `createTradingClient(baseUrl): TradingClient` from `@packages/api-client`.
- Produces: `tradingClient` from `@/shared/api` and required `env.client.NEXT_PUBLIC_API_ENDPOINT`.

- [ ] **Step 1: Add failing environment and configured-client tests**

Update `stubRequiredEnvironment()` in the env test:

```typescript
vi.stubEnv('NEXT_PUBLIC_API_ENDPOINT', 'http://localhost:8787');
```

Add a test that stubs the endpoint to an empty string and expects environment
validation to reject it.

Create `apps/dapp/src/__test__/shared/api/trading-client.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTradingClient: vi.fn(() => ({ getMarkets: vi.fn() })),
}));

vi.mock('@packages/api-client', () => ({
  createTradingClient: mocks.createTradingClient,
}));
vi.mock('@/shared/config', () => ({
  env: { client: { NEXT_PUBLIC_API_ENDPOINT: 'http://gateway.test' } },
}));

describe('[TradingClientConfiguration]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should configure the typed client with the validated gateway URL', async () => {
    await import('@/shared/api/trading-client');
    expect(mocks.createTradingClient).toHaveBeenCalledWith(
      'http://gateway.test',
    );
  });
});
```

- [ ] **Step 2: Run tests and verify the client module/required env do not exist**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/shared/config/env.test.ts src/__test__/shared/api/trading-client.test.ts
```

Expected: FAIL because the client module is missing and the endpoint is optional.

- [ ] **Step 3: Install pinned compatible dependencies**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp add '@packages/api-client@workspace:*' '@react-three/drei@10.7.7' '@react-three/fiber@9.6.1' 'three@0.185.1'
mise exec -- pnpm --filter @apps/dapp add --save-dev '@types/three@0.185.1'
```

Expected: `apps/dapp/package.json` and `pnpm-lock.yaml` change without touching
other workspace manifests.

- [ ] **Step 4: Require the endpoint and configure the singleton client**

In `apps/dapp/src/shared/config/env.ts`, use:

```typescript
NEXT_PUBLIC_API_ENDPOINT: z.url(),
```

Keep its existing `runtimeEnv` mapping. Set in `apps/dapp/.env.sample`:

```dotenv
NEXT_PUBLIC_API_ENDPOINT=http://localhost:8787
```

Create `apps/dapp/src/shared/api/trading-client.ts`:

```typescript
import { createTradingClient } from '@packages/api-client';
import { env } from '@/shared/config';

export const tradingClient = createTradingClient(
  env.client.NEXT_PUBLIC_API_ENDPOINT,
);
```

Export it from `apps/dapp/src/shared/api/index.ts` while retaining `xhr` and
`FetchError`.

- [ ] **Step 5: Update the repository HTTP rule**

In `AGENTS.md` under “HTTP layer”, replace the dapp transport sentence with:

```text
- `apps/dapp` data flows UI → model hook → same-slice `api/` → a configured
  transport from `@/shared/api`. ConnectRPC modules use typed shared clients;
  REST/BFF modules use `xhr`. Components call neither transport directly.
```

Keep the admin-specific Connect client rule unchanged.

- [ ] **Step 6: Verify config, client, and dependency graph**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/shared/config/env.test.ts src/__test__/shared/api/trading-client.test.ts
mise exec -- pnpm --filter @apps/dapp typecheck
```

Expected: both tests and typecheck PASS.

- [ ] **Step 7: Commit only the clean configured-client paths**

```bash
git add apps/dapp/.env.sample apps/dapp/package.json apps/dapp/src/shared/api apps/dapp/src/shared/config/env.ts apps/dapp/src/__test__/shared
git commit -m "feat(dapp): configure typed trading client"
```

Do not stage all of `AGENTS.md` or `pnpm-lock.yaml`: both contain prior user
work. Keep their dashboard-specific HTTP-rule and dependency-lock hunks in the
working tree and identify them explicitly in the final handoff.

## Task 3: Build and validate the market Page model

**Files:**

- Create source files under `apps/dapp/src/_pages/home/{api,model}/` listed in the file map.
- Create matching tests under `apps/dapp/src/__test__/_pages/home/{api,model}/`.

**Interfaces:**

- Consumes: `tradingClient.getMarkets(request, { signal })` from Shared API.
- Produces: `getMarkets(signal?): Promise<TMarketsSnapshot>`, `useMarkets()`, formatters, and `mapMarketsToScene(markets): TMarketSceneNode[]`.

- [ ] **Step 1: Write failing constants/schema/mapper tests**

Create `market.mapper.test.ts` with a generated-shape fixture and assert:

```typescript
expect(mapMarketsResponse({
  markets: [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      currentPrice: 70_000,
      marketCap: 1_400_000_000_000,
      marketCapRank: 1,
      priceChangePercentage24h: 2.5,
      totalVolume: 42_000_000_000,
    },
  ],
  vsCurrency: 'usd',
} as GetMarketsResponse)).toMatchObject({
  markets: [{ id: 'bitcoin', symbol: 'BTC', currentPrice: 70_000 }],
  vsCurrency: 'usd',
});
```

Also assert empty markets, unknown IDs, non-finite numbers, and a non-USD quote
throw Zod validation errors. Assert missing optional metrics remain undefined.

- [ ] **Step 2: Write failing API and scene-mapper tests**

Mock `@/shared/api` with a factory, call `getMarkets(signal)`, and assert:

```typescript
expect(tradingClient.getMarkets).toHaveBeenCalledWith(
  { coinIds: [...MARKET_COIN_IDS], vsCurrency: 'usd' },
  { signal },
);
```

Assert a rejected Connect call logs once and throws `MarketDataUnavailableError`
whose public message is exactly `Market data is temporarily unavailable.`.

For `mapMarketsToScene`, assert every output value is finite, scale stays in
`[0.72, 1.32]`, emissive intensity stays in `[0.35, 1.4]`, orbit radius is
bounded, and positive/negative changes select different color constants.

- [ ] **Step 3: Run model/API tests and verify modules are missing**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/api src/__test__/_pages/home/model
```

Expected: FAIL on missing Page model/API modules.

- [ ] **Step 4: Implement constants, schemas, mapping, and formatting**

Define in `market.constants.ts`:

```typescript
export const MARKET_COIN_IDS = [
  'bitcoin',
  'ethereum',
  'tether',
  'binancecoin',
  'solana',
  'ripple',
  'usd-coin',
  'dogecoin',
  'cardano',
  'avalanche-2',
] as const;

export const MARKET_QUOTE_CURRENCY = 'usd' as const;
export const MARKET_REFRESH_INTERVAL_MS = 60_000;
export const MARKET_QUERY_KEY = ['market', 'snapshot', 'usd'] as const;
```

`market.schema.ts` must derive `TMarket`, `TMarketsSnapshot`, and
`TMarketSummary` from `Z`-prefixed schemas. Require non-empty known IDs, trimmed
names/symbols, finite non-negative price/cap/volume, positive integer optional
rank, finite change fields, valid optional URL/ISO timestamp, and literal USD.

`market.mapper.ts` uppercases symbols, preserves missing optional values, sorts
by `MARKET_COIN_IDS`, parses through `ZMarketsSnapshot`, and exposes
`createMarketSummary(snapshot)` for total selected cap, selected 24h volume,
gainer/loser counts, and strongest gainer.

`market.formatters.ts` exposes:

```typescript
formatMarketPrice(value: number | undefined): string
formatCompactUsd(value: number | undefined): string
formatMarketChange(value: number | undefined): string
formatMarketTimestamp(value: string | undefined): string
```

All missing values return an em dash.

- [ ] **Step 5: Implement safe Connect API access**

Create `market.error.ts`:

```typescript
export class MarketDataUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Market data is temporarily unavailable.', options);
    this.name = 'MarketDataUnavailableError';
  }
}
```

Create `get-markets.api.ts`:

```typescript
export async function getMarkets(
  signal?: AbortSignal,
): Promise<TMarketsSnapshot> {
  try {
    const response = await tradingClient.getMarkets(
      { coinIds: [...MARKET_COIN_IDS], vsCurrency: MARKET_QUOTE_CURRENCY },
      { signal },
    );
    return mapMarketsResponse(response);
  } catch (error) {
    logger.error('[market-dashboard]', error);
    throw new MarketDataUnavailableError({ cause: error });
  }
}
```

Use absolute aliases for every same-slice import.

- [ ] **Step 6: Implement deterministic scene mapping**

`market-scene.mapper.ts` defines:

```typescript
export type TMarketSceneNode = {
  id: TMarket['id'];
  symbol: string;
  scale: number;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  verticalOffset: number;
  color: string;
  emissiveIntensity: number;
};
```

Use log-normalized market cap for scale, clamped absolute percentage change for
emissive intensity/speed, sign for color, stable index/golden-angle placement,
and explicit min/max constants matching the tests.

- [ ] **Step 7: Verify and commit the model/API deliverable**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/api src/__test__/_pages/home/model
mise exec -- pnpm --filter @apps/dapp typecheck
```

Expected: all focused tests and typecheck PASS.

```bash
git add apps/dapp/src/_pages/home/api apps/dapp/src/_pages/home/model apps/dapp/src/__test__/_pages/home/api apps/dapp/src/__test__/_pages/home/model
git commit -m "feat(dapp): add crypto market model"
```

## Task 4: Build the semantic dashboard and query states

**Files:**

- Create: `apps/dapp/src/_pages/home/model/use-markets.ts`
- Replace/Create: DOM UI files in `apps/dapp/src/_pages/home/ui/` except WebGL files.
- Create: matching hook/UI tests under `apps/dapp/src/__test__/_pages/home/`.

**Interfaces:**

- Consumes: `getMarkets`, `TMarketsSnapshot`, summary/formatters, and scene-node mapping from Task 3.
- Produces: public `HomePage`, client `MarketDashboard`, semantic metrics/table, loading/error/stale UI, and selected-market state for Task 5.

- [ ] **Step 1: Write the failing query-hook test**

Render `useMarkets()` with a fresh `QueryClient`, mock `getMarkets`, and assert
the query calls it with an `AbortSignal`. Inspect the cached query options and
assert `staleTime` and `refetchInterval` are both `60_000`, the query key equals
`MARKET_QUERY_KEY`, and retry is `2`.

- [ ] **Step 2: Write failing dashboard behavior tests**

Mock `useMarkets` and `MarketSceneLoader`. Cover:

- initial loading skeletons and neutral scene data;
- success values, USD formatting, gainer/loser text, and all ten asset names;
- `Updating` while `isFetching` with cached data;
- first-load generic error and Retry button;
- cached data retained with `Data may be stale` after refetch error;
- em dashes for optional missing values;
- selected asset changes when its “Highlight … in 3D” button receives focus.

Use roles and visible text rather than Panda class names.

- [ ] **Step 3: Run hook/UI tests and verify the dashboard modules are missing**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/model/use-markets.test.tsx src/__test__/_pages/home/ui
```

Expected: FAIL on missing hook/dashboard modules.

- [ ] **Step 4: Implement `useMarkets`**

```typescript
export const useMarkets = () =>
  useQuery({
    queryKey: MARKET_QUERY_KEY,
    queryFn: ({ signal }) => getMarkets(signal),
    staleTime: MARKET_REFRESH_INTERVAL_MS,
    refetchInterval: MARKET_REFRESH_INTERVAL_MS,
    retry: 2,
  });
```

- [ ] **Step 5: Implement the server/client composition and visual DOM shell**

`home-page.tsx` remains directive-free and renders:

```tsx
export function HomePage() {
  return (
    <main className={dashboardRootStyle}>
      <MarketDashboard />
    </main>
  );
}
```

`market-dashboard.tsx` owns selected asset state, calls `useMarkets`, reports
each new `errorUpdatedAt` once with `Sentry.captureException`, retains cached
data on refetch errors, and composes header, scene loader, metrics, state, and
table. It defines the dashboard's dark spatial-grid background through Panda
CSS with reusable CSS custom properties for cyan, violet, coral, panel, and
muted colors.

`market-header.tsx` renders “Vibe Markets”, live/updating/stale status, a
machine-readable last-updated `<time>`, and a keyboard-visible Refresh button.

`market-metrics.tsx` renders exactly four labeled cards: selected market cap,
selected 24h volume, strongest gainer, and gain/loss breadth. Labels explicitly
say the metrics describe the selected assets.

`market-table.tsx` renders a real table from `md` upward and a list of cards
below `md`. Each asset has a button named `Highlight {name} in 3D`; focus/hover
calls `onActiveMarketChange(id)`. Positive/negative direction includes arrow
text/icon plus color.

`market-state.tsx` exports loading skeletons and the generic retry/stale notices.
It never renders `error.message`.

- [ ] **Step 6: Verify and commit the semantic dashboard**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/model/use-markets.test.tsx src/__test__/_pages/home/ui
mise exec -- pnpm --filter @apps/dapp lint:architecture
mise exec -- pnpm --filter @apps/dapp typecheck
```

Expected: tests, FSD architecture, and typecheck PASS.

```bash
git add apps/dapp/src/_pages/home apps/dapp/src/__test__/_pages/home
git commit -m "feat(dapp): build crypto market dashboard"
```

## Task 5: Add the React Three Fiber market scene

**Files:**

- Create: `apps/dapp/src/_pages/home/ui/market-scene.tsx`
- Create: `apps/dapp/src/_pages/home/ui/market-scene-loader.tsx`
- Create: `apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx`
- Create: `apps/dapp/src/_pages/home/ui/use-market-scene-activity.ts`
- Create: `apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx`
- Create: `apps/dapp/src/__test__/_pages/home/ui/use-market-scene-activity.test.tsx`

**Interfaces:**

- Consumes: `TMarket[]`, `TMarketSceneNode[]`, active market ID, and active-change callback.
- Produces: `MarketSceneLoader` with dynamic `ssr: false`, a real WebGL scene, DOM selected-asset panel, reduced-motion/offscreen behavior, and static fallback.

- [ ] **Step 1: Write failing scene-boundary tests**

Mock `@react-three/fiber` so `Canvas` records `dpr`, `frameloop`, and `fallback`.
Mock Drei primitives to lightweight test elements. Assert:

- Canvas receives `dpr={[1, 1.5]}` and the static fallback;
- active/offscreen state selects `always`/`demand` frameloop;
- reduced motion selects `demand` and disables orbital updates;
- selected asset name/price/change appear in a DOM `role="status"` panel;
- pointer selection calls `onActiveMarketChange`;
- forcing the Canvas mock to render its fallback shows the static scene.

- [ ] **Step 2: Run scene tests and verify the modules are missing**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-scene.test.tsx src/__test__/_pages/home/ui/use-market-scene-activity.test.tsx
```

Expected: FAIL on missing scene modules.

- [ ] **Step 3: Implement the activity hook and fallback**

`use-market-scene-activity.ts` combines `useReducedMotion`, an
`IntersectionObserver`, and `visibilitychange` into:

```typescript
type TMarketSceneActivity = {
  containerRef: RefObject<HTMLDivElement | null>;
  shouldAnimate: boolean;
  reducedMotion: boolean;
};
```

Remove all listeners/observers on cleanup. When those browser APIs are absent,
default to visible and non-reduced motion.

`market-scene-fallback.tsx` renders a non-canvas luminous core and ten static
token rings using semantic-free decorative elements with `aria-hidden="true"`.

- [ ] **Step 4: Implement the WebGL world**

`market-scene.tsx` is a client module. Render:

```tsx
<Canvas
  aria-hidden="true"
  dpr={[1, 1.5]}
  frameloop={shouldAnimate ? 'always' : 'demand'}
  fallback={<MarketSceneFallback />}
  camera={{ position: [0, 1.2, 9], fov: 42 }}
  gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
>
  <ambientLight intensity={0.55} />
  <pointLight position={[0, 1, 3]} intensity={18} color="#67e8f9" />
  <MarketWorld
    nodes={nodes}
    activeMarketId={activeMarketId}
    animate={shouldAnimate}
    onActiveMarketChange={onActiveMarketChange}
  />
</Canvas>
```

`MarketWorld` contains a low-poly emissive icosahedron core, subtle rings and
sparkles, and ten extruded cylinder token meshes. `useFrame` applies bounded
pointer parallax and deterministic node orbits only when `animate` is true.
Hovered/active tokens increase emissive intensity without allocating new
materials per frame. Do not add physics, post-processing, remote textures, or
real-time shadows.

Outside Canvas, render the selected asset's name, formatted price, and signed
24h change in a DOM status panel.

- [ ] **Step 5: Implement the dynamic loader**

`market-scene-loader.tsx` uses:

```typescript
const MarketScene = dynamic(
  () =>
    import('@/_pages/home/ui/market-scene').then(
      (module) => module.MarketScene,
    ),
  { ssr: false, loading: () => <MarketSceneFallback /> },
);
```

Export a typed `MarketSceneLoader` wrapper and use it from `MarketDashboard`.

- [ ] **Step 6: Verify scene behavior, bundle boundary, and build**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui
mise exec -- pnpm --filter @apps/dapp typecheck
mise exec -- pnpm --filter @apps/dapp build
```

Expected: UI/scene tests PASS, TypeScript recognizes R3F JSX, build emits the
WebGL scene as an async client chunk, and no server bundle evaluates WebGL.

- [ ] **Step 7: Commit the scene**

```bash
git add apps/dapp/src/_pages/home/ui apps/dapp/src/__test__/_pages/home/ui
git commit -m "feat(dapp): add WebGL market scene"
```

## Task 6: Update product metadata, add browser coverage, and finish

**Files:**

- Modify: `apps/dapp/src/_app/metadata/app-metadata.ts`
- Modify: `apps/dapp/src/_app/metadata/manifest.ts`
- Create: `apps/dapp/e2e/market-dashboard.test.ts`
- Modify: `apps/dapp/e2e/navigation.test.ts`
- Modify: `apps/dapp/e2e/smoke.test.ts`

**Interfaces:**

- Consumes: completed dashboard and direct Connect endpoint.
- Produces: Vibe Markets metadata and deterministic browser coverage for success/error retry.

- [ ] **Step 1: Update failing title expectations and add gateway route fixtures**

Change existing home title assertions to `/Vibe Markets/i`.

In `market-dashboard.test.ts`, intercept both OPTIONS and POST requests matching
`**/trading.v1.TradingService/GetMarkets`. OPTIONS returns CORS headers and 204;
POST returns a deterministic Connect JSON response containing all ten assets.
Assert the page shows the Vibe Markets heading, Bitcoin price, selected-market
metrics, table heading, and no console errors.

Add a second test whose POST route returns a Connect-style 503 until a local
`shouldFail` flag is set false; assert the generic error, flip the flag, click
Retry, and assert Bitcoin appears. Never assert raw upstream error text.

- [ ] **Step 2: Run browser tests and verify the old metadata/dashboard fail**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp exec playwright test e2e/market-dashboard.test.ts e2e/navigation.test.ts e2e/smoke.test.ts
```

Expected: FAIL until metadata and the complete dashboard behavior are wired.

- [ ] **Step 3: Update metadata and manifest**

Set:

```typescript
const APP_NAME = 'Vibe Markets';
const APP_DESCRIPTION =
  'A real-time crypto market command deck powered by typed ConnectRPC data and an interactive WebGL scene.';
```

Update keywords to crypto market, WebGL, ConnectRPC, and the current stack. Set
manifest name/short name/description and dark background/theme colors to match
the dashboard.

- [ ] **Step 4: Run browser tests and visually inspect the real dev topology**

Run the focused Playwright command again; expected PASS.

With `mise run dev` running, open `http://127.0.0.1:3000/` in a browser and
verify desktop and mobile widths, WebGL motion, reduced-motion emulation,
keyboard focus, loading/refetch status, and that the live request reaches
`http://127.0.0.1:8787/trading.v1.TradingService/GetMarkets`.

- [ ] **Step 5: Commit metadata and browser coverage**

```bash
git add apps/dapp/e2e apps/dapp/src/_app/metadata
git commit -m "test(dapp): cover crypto dashboard flow"
```

- [ ] **Step 6: Verify no stale boilerplate or raw transport remains**

Run:

```bash
rg -n 'AI-First Next\.js Boilerplate|Build with AI|create-next-app' apps/dapp
rg -n 'fetch\(|axios|trading\.v1\.TradingService/GetMarkets' apps/dapp/src/_pages/home
```

Expected: both searches return no matches. The literal RPC path may appear only
in gateway config/tests and Playwright route fixtures, never dapp production
source.

- [ ] **Step 7: Run architecture checks and definition-of-done gates**

Run:

```bash
mise exec -- pnpm --filter @apps/dapp lint:architecture
mise exec -- pnpm --filter @services/api-gateway lint:architecture
mise run typecheck
mise run check:ci
mise run lint
mise run test
mise run build
```

Expected: every applicable gate PASS. If the two known trading-rpc HTTP/2
shutdown-hook tests still time out, reproduce them on the pre-dashboard baseline
and report them separately; do not modify that unrelated lifecycle behavior as
part of the dashboard.

- [ ] **Step 8: Review the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no dashboard whitespace errors. Pre-existing unrelated worktree
changes remain uncommitted, together with the intentionally unstaged dashboard
hunks in `AGENTS.md` and `pnpm-lock.yaml`. Identify those two dashboard hunks in
the handoff. Do not deploy.
