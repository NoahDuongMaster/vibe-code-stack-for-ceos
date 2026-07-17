# Dapp Liquidity Reactor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic planetary crypto dashboard with a responsive degen trading terminal whose WebGL liquidity reactor and semantic watchlist are driven by the existing ConnectRPC market snapshot.

**Architecture:** Keep the existing `_pages/home` Page slice, `MarketDashboard` client boundary, TanStack Query hook, Zod model, and configured ConnectRPC client. Extend the pure scene mapper with bounded blade values, compose a new Page-local watchlist and terminal header around one `activeMarketId`, and dynamically render the heavy reactor while all essential information remains in semantic DOM.

**Tech Stack:** Next.js 16 on vinext, React 19, TypeScript 6 strict, Panda CSS 1, TanStack Query 5, ConnectRPC 2, React Three Fiber 9, Drei 10, Three.js 0.185, Vitest 4, Testing Library, Playwright.

## Global Constraints

- Preserve the existing API flow: `MarketDashboard -> useMarkets -> getMarkets -> configured ConnectRPC TradingClient -> API Gateway`.
- Use only Void `#050507`, Carbon `#0A0D0B`, Bone `#E9F1E2`, Toxic `#C7FF2F`, Plasma `#8B5CF6`, Rekt `#FF3B5C`, and alpha variants for the dashboard visual system.
- Use Unbounded for identity/display, Manrope for body/control copy, and IBM Plex Mono with tabular numerals for market data.
- Keep the canvas dynamically imported with `{ ssr: false }`, `aria-hidden`, DPR capped at `[1, 1.5]`, and free of real-time shadows, remote textures, and mandatory post-processing.
- Preserve WebGL fallback, reduced-motion, offscreen, and hidden-document behavior.
- Keep `home-page.tsx` server-rendered and `market-dashboard.tsx` as the narrow client boundary.
- All frontend-local imports use `@/` or `@root/`; do not add relative imports.
- Do not add packages, backend changes, trading features, charts, wallets, or fabricated history.
- Never hand-edit `apps/dapp/src/styled-system/**`; regenerate it through the existing `prepare` command after Panda config changes.
- Follow red/green/refactor for every behavior change and commit only task-owned files because the worktree already contains unrelated user changes.

---

## File Structure

### Create

- `apps/dapp/src/_pages/home/ui/market-watchlist.tsx` — first-viewport ten-asset selection rail.
- `apps/dapp/src/__test__/_pages/home/ui/market-watchlist.test.tsx` — keyboard and selection behavior for the rail.

### Modify

- `apps/dapp/src/_pages/home/model/market-scene.mapper.ts` — map snapshot values to finite blade geometry and energy.
- `apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts` — bounds, missing data, color, volume, and stable-lane tests.
- `apps/dapp/app/layout.tsx` — load the three approved font roles through `next/font/google`.
- `apps/dapp/panda.config.ts` — expose font and palette tokens; generated output is regenerated, not edited.
- `apps/dapp/src/_pages/home/ui/home-page.tsx` — Void terminal background and restrained atmosphere.
- `apps/dapp/src/_pages/home/ui/market-dashboard.tsx` — compose terminal header, 9/3 reactor/watchlist, metric rail, states, and table.
- `apps/dapp/src/_pages/home/ui/market-header.tsx` — `VIBE//X`, three-asset tape, live state, time, and refresh.
- `apps/dapp/src/_pages/home/ui/market-metrics.tsx` — compact instrument rail.
- `apps/dapp/src/_pages/home/ui/market-table.tsx` — dense comparison surface that shares selection semantics.
- `apps/dapp/src/_pages/home/ui/market-state.tsx` — loading, stale, and initial-error terminal states.
- `apps/dapp/src/_pages/home/ui/market-scene.tsx` — WebGL blade reactor, scan plane, bounded camera drift, and active DOM readout.
- `apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx` — CSS reactor silhouette with ten deterministic blades.
- `apps/dapp/src/_pages/home/ui/market-scene-shell.ts` — clipped reactor shell and responsive height.
- `apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx` — terminal composition and shared selection state.
- `apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx` — reactor renderer boundary, selection, and reduced-motion behavior.
- `apps/dapp/e2e/market-dashboard.test.ts` — first-viewport, mobile overflow, and data-driven browser acceptance.

### Preserve Unchanged

- `apps/dapp/src/_pages/home/api/get-markets.api.ts`
- `apps/dapp/src/_pages/home/model/use-markets.ts`
- `apps/dapp/src/shared/api/trading-client.ts`
- `packages/protocol/**`
- `services/api-gateway/**`
- `services/trading-rpc/**`

---

### Task 1: Map Markets Into Liquidity Blades

**Files:**
- Modify: `apps/dapp/src/_pages/home/model/market-scene.mapper.ts`
- Test: `apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts`

**Interfaces:**
- Consumes: `TMarket[]` from `@/_pages/home/model/market.schema`.
- Produces: `mapMarketsToScene(markets: TMarket[]): TMarketSceneNode[]` where each node contains `position`, `height`, `width`, `depth`, `lean`, `pulseStrength`, `revealDelay`, `color`, and `emissiveIntensity`.

- [ ] **Step 1: Replace the orbital expectations with failing blade tests**

```typescript
import { describe, expect, it } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import {
  MARKET_NEGATIVE_COLOR,
  MARKET_NEUTRAL_COLOR,
  MARKET_POSITIVE_COLOR,
  mapMarketsToScene,
} from '@/_pages/home/model/market-scene.mapper';

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    marketCap: 1_400_000_000_000,
    totalVolume: 52_000_000_000,
    priceChangePercentage24h: 12,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    marketCap: 500_000_000_000,
    totalVolume: 19_000_000_000,
    priceChangePercentage24h: -8,
  },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
];

describe('[MarketSceneMapper]', () => {
  it('should produce finite and bounded liquidity blade values', () => {
    const nodes = mapMarketsToScene(markets);

    expect(nodes).toHaveLength(3);
    for (const node of nodes) {
      const numericValues = [
        ...node.position,
        node.height,
        node.width,
        node.depth,
        node.lean,
        node.pulseStrength,
        node.revealDelay,
        node.emissiveIntensity,
      ];
      expect(numericValues.every(Number.isFinite)).toBe(true);
      expect(node.height).toBeGreaterThanOrEqual(0.9);
      expect(node.height).toBeLessThanOrEqual(3.6);
      expect(node.width).toBeGreaterThanOrEqual(0.54);
      expect(node.width).toBeLessThanOrEqual(0.86);
      expect(Math.abs(node.lean)).toBeLessThanOrEqual(0.26);
      expect(node.pulseStrength).toBeGreaterThanOrEqual(0.18);
      expect(node.pulseStrength).toBeLessThanOrEqual(1);
    }
  });

  it('should encode direction, volume, and stable request-order lanes', () => {
    const nodes = mapMarketsToScene(markets);

    expect(nodes[0]?.color).toBe(MARKET_POSITIVE_COLOR);
    expect(nodes[1]?.color).toBe(MARKET_NEGATIVE_COLOR);
    expect(nodes[2]?.color).toBe(MARKET_NEUTRAL_COLOR);
    expect(nodes[0]?.pulseStrength).toBeGreaterThan(
      nodes[1]?.pulseStrength ?? 0,
    );
    expect(nodes.map(({ position }) => position)).toEqual([
      [-2.5, 0, -1.45],
      [-1.25, 0, -1.45],
      [0, 0, -1.45],
    ]);
  });

  it('should map missing optional data to deterministic neutral values', () => {
    const first = mapMarketsToScene([markets[2] as TMarket])[0];
    const second = mapMarketsToScene([markets[2] as TMarket])[0];

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      color: MARKET_NEUTRAL_COLOR,
      height: 1.386,
      pulseStrength: 0.3276,
    });
  });
});
```

- [ ] **Step 2: Run the mapper test and verify RED**

Run:

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/model/market-scene.mapper.test.ts
```

Expected: FAIL because `TMarketSceneNode` has orbital fields and no blade geometry fields.

- [ ] **Step 3: Replace the mapper with the bounded blade implementation**

```typescript
import type { TMarket } from '@/_pages/home/model/market.schema';

export const MARKET_POSITIVE_COLOR = '#C7FF2F';
export const MARKET_NEGATIVE_COLOR = '#FF3B5C';
export const MARKET_NEUTRAL_COLOR = '#8B5CF6';

const MIN_HEIGHT = 0.9;
const MAX_HEIGHT = 3.6;
const MIN_WIDTH = 0.54;
const MAX_WIDTH = 0.86;
const MIN_DEPTH = 0.5;
const MAX_DEPTH = 0.78;
const MIN_PULSE = 0.18;
const MAX_PULSE = 1;
const MIN_EMISSIVE = 0.3;
const MAX_EMISSIVE = 1.35;
const MAX_CHANGE_MAGNITUDE = 15;

export type TMarketSceneNode = {
  id: TMarket['id'];
  symbol: string;
  position: readonly [number, number, number];
  height: number;
  width: number;
  depth: number;
  lean: number;
  pulseStrength: number;
  revealDelay: number;
  color: string;
  emissiveIntensity: number;
};

const normalizeLogValues = (
  markets: TMarket[],
  select: (market: TMarket) => number | undefined,
): Map<TMarket['id'], number> => {
  const entries = markets.flatMap((market) => {
    const value = select(market);
    return value === undefined
      ? []
      : ([[market.id, Math.log1p(value)]] as const);
  });
  const values = entries.map(([, value]) => value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const range = maximum - minimum;

  return new Map(
    entries.map(([id, value]) => [
      id,
      range === 0 ? 0.5 : (value - minimum) / range,
    ]),
  );
};

export const mapMarketsToScene = (markets: TMarket[]): TMarketSceneNode[] => {
  const normalizedCaps = normalizeLogValues(markets, ({ marketCap }) => marketCap);
  const normalizedVolumes = normalizeLogValues(
    markets,
    ({ totalVolume }) => totalVolume,
  );

  return markets.map((market, index) => {
    const change = market.priceChangePercentage24h ?? 0;
    const normalizedChange =
      Math.min(Math.abs(change), MAX_CHANGE_MAGNITUDE) / MAX_CHANGE_MAGNITUDE;
    const normalizedCap = normalizedCaps.get(market.id) ?? 0.18;
    const normalizedVolume = normalizedVolumes.get(market.id) ?? 0.18;
    const column = index % 5;
    const row = index < 5 ? -1 : 1;

    return {
      id: market.id,
      symbol: market.symbol,
      position: [(column - 2) * 1.25, 0, row * 1.45],
      height: MIN_HEIGHT + normalizedCap * (MAX_HEIGHT - MIN_HEIGHT),
      width: MIN_WIDTH + normalizedCap * (MAX_WIDTH - MIN_WIDTH),
      depth: MIN_DEPTH + normalizedCap * (MAX_DEPTH - MIN_DEPTH),
      lean: Math.sign(change) * (0.08 + normalizedChange * 0.18),
      pulseStrength: MIN_PULSE + normalizedVolume * (MAX_PULSE - MIN_PULSE),
      revealDelay: index * 0.06,
      color:
        change > 0
          ? MARKET_POSITIVE_COLOR
          : change < 0
            ? MARKET_NEGATIVE_COLOR
            : MARKET_NEUTRAL_COLOR,
      emissiveIntensity:
        MIN_EMISSIVE + normalizedChange * (MAX_EMISSIVE - MIN_EMISSIVE),
    };
  });
};
```

- [ ] **Step 4: Run mapper tests and verify GREEN**

Run the focused command from Step 2.

Expected: PASS with three tests and no warnings.

- [ ] **Step 5: Commit the scene model**

```bash
git add apps/dapp/src/_pages/home/model/market-scene.mapper.ts apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts
git commit -m "refactor(dapp): map markets into liquidity blades"
```

---

### Task 2: Build The Semantic Terminal Shell And Watchlist

**Files:**
- Create: `apps/dapp/src/_pages/home/ui/market-watchlist.tsx`
- Create: `apps/dapp/src/__test__/_pages/home/ui/market-watchlist.test.tsx`
- Modify: `apps/dapp/panda.config.ts`
- Generated by command: `apps/dapp/src/styled-system/**`
- Modify: `apps/dapp/src/_pages/home/ui/market-header.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-dashboard.tsx`
- Modify: `apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx`

**Interfaces:**
- Consumes: `TMarket[]`, `activeMarketId`, and `onActiveMarketChange` from `MarketDashboard`.
- Produces: `MarketWatchlist(props)` with `aria-label="Market watch"`; `MarketHeader` receives `markets: TMarket[]` for the first three tape values.

- [ ] **Step 1: Add failing watchlist and terminal composition tests**

Create the watchlist test:

```typescript
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { MarketWatchlist } from '@/_pages/home/ui/market-watchlist';

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    currentPrice: 70_000,
    priceChangePercentage24h: 2.5,
    marketCapRank: 1,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    currentPrice: 3_500,
    priceChangePercentage24h: -1.25,
    marketCapRank: 2,
  },
];

describe('[MarketWatchlist]', () => {
  it('should expose every asset as a native selection control', () => {
    const onActiveMarketChange = vi.fn();
    render(
      <MarketWatchlist
        activeMarketId="bitcoin"
        markets={markets}
        onActiveMarketChange={onActiveMarketChange}
      />,
    );

    expect(screen.getByRole('region', { name: 'Market watch' })).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Select Bitcoin' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.focus(screen.getByRole('button', { name: 'Select Ethereum' }));
    expect(onActiveMarketChange).toHaveBeenCalledWith('ethereum');
  });
});
```

In `market-dashboard.test.tsx`, change the success and focus expectations to:

```typescript
expect(screen.getByRole('heading', { name: 'VIBE//X' })).toBeTruthy();
expect(screen.getByRole('region', { name: 'Market watch' })).toBeTruthy();
expect(screen.getByText('Market matrix')).toBeTruthy();
expect(screen.queryByText('Scene telemetry')).toBeNull();

fireEvent.focus(screen.getByRole('button', { name: 'Select Ethereum' }));
expect(screen.getByTestId('market-scene').textContent).toContain(
  'Scene: 10 / ethereum',
);
```

- [ ] **Step 2: Run both UI tests and verify RED**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-watchlist.test.tsx src/__test__/_pages/home/ui/market-dashboard.test.tsx
```

Expected: FAIL because `market-watchlist.tsx` does not exist and the old header still says “Vibe Markets”.

- [ ] **Step 3: Add the approved palette and font-role tokens before consuming them**

Extend `panda.config.ts` without removing existing tokens:

```typescript
tokens: {
  colors: {
    void: { value: '#050507' },
    carbon: { value: '#0A0D0B' },
    bone: { value: '#E9F1E2' },
    toxic: { value: '#C7FF2F' },
    plasma: { value: '#8B5CF6' },
    rekt: { value: '#FF3B5C' },
  },
  fonts: {
    display: { value: 'var(--font-display), ui-sans-serif, system-ui, sans-serif' },
    sans: { value: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif' },
    mono: { value: 'var(--font-mono), ui-monospace, monospace' },
  },
}
```

Regenerate the typed Panda API through the supported command:

```bash
pnpm --filter @apps/dapp prepare
```

Expected: codegen exits zero and generated token types recognize the six palette
names plus `display`, `sans`, and `mono`.

- [ ] **Step 4: Create the Page-local watchlist**

Implement `MarketWatchlist` with this public surface and semantic structure:

```typescript
import {
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { css, cx } from '@/styled-system/css';

type TMarketWatchlistProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

export function MarketWatchlist({
  activeMarketId,
  markets,
  onActiveMarketChange,
}: TMarketWatchlistProps) {
  return (
    <section
      aria-label="Market watch"
      className={css({
        minH: 0,
        bgColor: 'carbon',
        borderWidth: '1px',
        borderColor: 'bone/12',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: '4',
          py: '3',
          borderBottomWidth: '1px',
          borderColor: 'bone/12',
          fontFamily: 'mono',
          fontSize: '2xs',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        })}
      >
        <span>Market watch</span>
        <span className={css({ color: 'toxic' })}>{markets.length} assets</span>
      </div>
      <ol className={css({ listStyle: 'none' })}>
        {markets.map((market, index) => {
          const active = market.id === activeMarketId;
          const positive = (market.priceChangePercentage24h ?? 0) > 0;
          return (
            <li key={market.id}>
              <button
                type="button"
                aria-label={`Select ${market.name}`}
                aria-pressed={active}
                className={cx(
                  css({
                    display: 'grid',
                    gridTemplateColumns: '2.25rem minmax(0, 1fr) auto',
                    alignItems: 'center',
                    w: 'full',
                    px: '4',
                    py: '3',
                    color: 'bone',
                    borderBottomWidth: '1px',
                    borderColor: 'bone/8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    _hover: { bgColor: 'bone/4' },
                    _focusVisible: {
                      outline: '2px solid token(colors.toxic)',
                      outlineOffset: '-2px',
                    },
                  }),
                  active ? css({ bgColor: 'toxic/8' }) : undefined,
                )}
                onFocus={() => onActiveMarketChange(market.id)}
                onMouseEnter={() => onActiveMarketChange(market.id)}
                onClick={() => onActiveMarketChange(market.id)}
              >
                <span className={css({ color: 'bone/40', fontFamily: 'mono' })}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong className={css({ display: 'block' })}>{market.symbol}</strong>
                  <span className={css({ color: 'bone/48', fontSize: 'xs' })}>
                    {market.name}
                  </span>
                </span>
                <span className={css({ fontFamily: 'mono', textAlign: 'right' })}>
                  <span className={css({ display: 'block' })}>
                    {formatMarketPrice(market.currentPrice)}
                  </span>
                  <span className={css({ color: positive ? 'toxic' : 'rekt' })}>
                    {formatMarketChange(market.priceChangePercentage24h)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

- [ ] **Step 5: Replace the generic header with the compact terminal bar**

Change `TMarketHeaderProps` to include `markets: TMarket[]`. Render:

```tsx
<header className={headerStyle}>
  <div className={identityStyle}>
    <p className={kickerStyle}>On-chain market terminal / USD</p>
    <h1 className={wordmarkStyle}>VIBE//X</h1>
  </div>
  <div aria-label="Market tape" className={tapeStyle}>
    {markets.slice(0, 3).map((market) => (
      <span key={market.id} className={tapeItemStyle}>
        <strong>{market.symbol}</strong>
        <span>{formatMarketPrice(market.currentPrice)}</span>
        <span style={{ color: changeTone(market.priceChangePercentage24h) }}>
          {formatMarketChange(market.priceChangePercentage24h)}
        </span>
      </span>
    ))}
  </div>
  <div className={statusActionsStyle}>
    <div aria-live="polite" className={statusStyle}>
      <Activity aria-hidden="true" size={14} />
      <span>{STATUS_LABELS[status]}</span>
      {isoTimestamp ? <time dateTime={isoTimestamp}>{localTime}</time> : null}
    </div>
    <button type="button" className={refreshButtonStyle} onClick={onRefresh}>
      <RefreshCw aria-hidden="true" size={14} />
      Refresh
    </button>
  </div>
</header>
```

Add these definitions in the same file so every identifier in the JSX is local:

```typescript
const changeTone = (change: number | undefined): string =>
  change === undefined || change === 0
    ? '#8B5CF6'
    : change > 0
      ? '#C7FF2F'
      : '#FF3B5C';

const headerStyle = css({
  display: 'grid',
  gridTemplateColumns: { base: '1fr auto', lg: 'auto minmax(0, 1fr) auto' },
  alignItems: 'stretch',
  color: 'bone',
  bgColor: 'carbon',
  borderWidth: '1px',
  borderColor: 'bone/12',
});
const identityStyle = css({ px: '4', py: '3', borderColor: 'bone/12' });
const kickerStyle = css({
  color: 'bone/42',
  fontFamily: 'mono',
  fontSize: '2xs',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
});
const wordmarkStyle = css({
  mt: '1',
  fontFamily: 'display',
  fontSize: { base: '2xl', md: '3xl' },
  fontWeight: '800',
  letterSpacing: '-0.08em',
});
const tapeStyle = css({
  display: { base: 'none', lg: 'flex' },
  alignItems: 'stretch',
  minW: 0,
  overflow: 'hidden',
  borderInlineWidth: '1px',
  borderColor: 'bone/12',
});
const tapeItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  px: '4',
  fontFamily: 'mono',
  fontSize: 'xs',
  borderInlineEndWidth: '1px',
  borderColor: 'bone/8',
});
const statusActionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '3',
  px: '4',
});
const statusStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  color: 'toxic',
  fontFamily: 'mono',
  fontSize: '2xs',
  textTransform: 'uppercase',
});
const refreshButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  px: '3',
  py: '2',
  color: 'bone',
  borderWidth: '1px',
  borderColor: 'bone/18',
  fontFamily: 'mono',
  fontSize: '2xs',
  cursor: 'pointer',
  _hover: { color: 'toxic', borderColor: 'toxic' },
  _focusVisible: { outline: '2px solid #C7FF2F', outlineOffset: '2px' },
});
```

Compute `localTime` as
`isoTimestamp ? new Date(isoTimestamp).toLocaleTimeString('en-US') : undefined`.
Import `formatMarketChange`, `formatMarketPrice`, and `TMarket` from the home
Page model. Do not retain the previous marketing paragraph or rounded
full-width hero heading.

- [ ] **Step 6: Compose the 9/3 first viewport in `MarketDashboard`**

Pass `markets` into `MarketHeader`, replace the scene-telemetry aside with
`MarketWatchlist`, and use this hierarchy:

```typescript
const reactorGridStyle = grid({
  columns: { base: 1, xl: 12 },
  gap: '3',
  mt: '3',
});
```

```tsx
<MarketHeader
  lastUpdatedAt={query.dataUpdatedAt || undefined}
  markets={markets}
  onRefresh={() => void query.refetch()}
  status={status}
/>
<div className={reactorGridStyle}>
  <div className={css({ gridColumn: { xl: 'span 9' } })}>
    <MarketSceneLoader
      activeMarketId={activeMarketId}
      markets={markets}
      nodes={sceneNodes}
      onActiveMarketChange={setRequestedMarketId}
    />
  </div>
  <div className={css({ gridColumn: { xl: 'span 3' }, minH: 0 })}>
    <MarketWatchlist
      activeMarketId={activeMarketId}
      markets={markets}
      onActiveMarketChange={setRequestedMarketId}
    />
  </div>
</div>
```

Keep existing Sentry capture, stale/error logic, metric calculation, and table
data flow unchanged.

- [ ] **Step 7: Run UI tests and verify GREEN**

Run the command from Step 2.

Expected: PASS; keyboard focus on the watchlist changes the scene selection.

Also run:

```bash
pnpm --filter @apps/dapp typecheck
```

Expected: zero TypeScript errors with the generated Panda token types.

- [ ] **Step 8: Commit semantic terminal composition**

```bash
git add apps/dapp/panda.config.ts apps/dapp/src/styled-system apps/dapp/src/_pages/home/ui/market-watchlist.tsx apps/dapp/src/_pages/home/ui/market-header.tsx apps/dapp/src/_pages/home/ui/market-dashboard.tsx apps/dapp/src/__test__/_pages/home/ui/market-watchlist.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx
git commit -m "feat(dapp): build liquidity terminal shell"
```

---

### Task 3: Replace The Planetary Scene With The WebGL Reactor

**Files:**
- Modify: `apps/dapp/src/_pages/home/ui/market-scene.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-scene-shell.ts`
- Test: `apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx`

**Interfaces:**
- Consumes: the new `TMarketSceneNode[]`, `TMarket[]`, shared `activeMarketId`, and selection callback.
- Produces: decorative `Canvas`, clickable `mesh[name=market.id]` blades, ten-blade CSS fallback, and an accessible DOM selected-market status.

- [ ] **Step 1: Update the renderer-boundary tests for blades and fallback**

Replace the node fixtures with the Task 1 interface:

```typescript
const nodes: TMarketSceneNode[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    position: [-0.625, 0, -1.45],
    height: 3.2,
    width: 0.82,
    depth: 0.72,
    lean: 0.11,
    pulseStrength: 0.9,
    revealDelay: 0,
    color: '#C7FF2F',
    emissiveIntensity: 1,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    position: [0.625, 0, 1.45],
    height: 2.4,
    width: 0.72,
    depth: 0.64,
    lean: -0.1,
    pulseStrength: 0.6,
    revealDelay: 0.06,
    color: '#FF3B5C',
    emissiveIntensity: 0.8,
  },
];
```

Rename the interaction test to `should select a liquidity blade from a pointer interaction`, retain the query for `mesh[name="ethereum"]`, and add:

```typescript
expect(container.querySelector('icosahedronGeometry')).toBeNull();
expect(container.querySelectorAll('boxGeometry').length).toBeGreaterThan(0);

r3fMocks.renderFallback = true;
render(
  <MarketScene
    activeMarketId="bitcoin"
    markets={markets}
    nodes={nodes}
    onActiveMarketChange={vi.fn()}
  />,
);
expect(screen.getAllByTestId('reactor-fallback-blade')).toHaveLength(10);
```

Mock both Drei primitives used by the scene:

```typescript
vi.mock('@react-three/drei', () => ({
  Grid: () => null,
  Sparkles: () => null,
}));
```

- [ ] **Step 2: Run the scene test and verify RED**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-scene.test.tsx
```

Expected: FAIL because the implementation still consumes orbital fields and renders an icosahedron/cylinders.

- [ ] **Step 3: Implement reusable blade geometry and bounded animation**

Replace the old token/orbit implementation with these units:

```typescript
type TMarketBladeProps = {
  active: boolean;
  animate: boolean;
  node: TMarketSceneNode;
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

function MarketBlade({
  active,
  animate,
  node,
  onActiveMarketChange,
}: TMarketBladeProps) {
  const bladeRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  useFrame(({ clock }, delta) => {
    if (!animate || !bladeRef.current) return;
    const reveal = MathUtils.clamp(
      (clock.elapsedTime - node.revealDelay) * 1.8,
      0,
      1,
    );
    bladeRef.current.position.y = MathUtils.damp(
      bladeRef.current.position.y,
      (node.height * reveal) / 2,
      5,
      delta,
    );
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.6 + node.revealDelay) * 0.025;
    bladeRef.current.scale.y = highlighted ? pulse * 1.035 : pulse;
  });

  return (
    <group
      ref={bladeRef}
      position={[
        node.position[0],
        animate ? 0 : node.height / 2,
        node.position[2],
      ]}
      rotation={[0, 0, node.lean]}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: equivalent keyboard selection is provided by MarketWatchlist and MarketTable. */}
      <mesh
        name={node.id}
        onClick={(event) => {
          event.stopPropagation();
          onActiveMarketChange(node.id);
        }}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
      >
        <boxGeometry args={[node.width, node.height, node.depth]} />
        <meshStandardMaterial
          color={highlighted ? '#E9F1E2' : node.color}
          emissive={node.color}
          emissiveIntensity={
            node.emissiveIntensity * (highlighted ? 1.5 : node.pulseStrength)
          }
          metalness={0.72}
          roughness={0.24}
        />
      </mesh>
      {highlighted ? (
        <mesh position={[0, node.height / 2 + 0.05, 0]}>
          <boxGeometry args={[node.width * 1.35, 0.025, node.depth * 1.35]} />
          <meshBasicMaterial color="#C7FF2F" />
        </mesh>
      ) : null}
    </group>
  );
}
```

Add this `ScanPlane`, whose frame callback returns without mutation when motion
is disabled:

```typescript
function ScanPlane({ animate }: { animate: boolean }) {
  const scanRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!animate || !scanRef.current) return;
    const progress = (clock.elapsedTime * 0.18) % 1;
    scanRef.current.position.x = MathUtils.lerp(-3.8, 3.8, progress);
  });

  return (
    <group ref={scanRef} position={[-3.8, 1.5, 0]}>
      <mesh>
        <boxGeometry args={[0.018, 3.4, 7]} />
        <meshBasicMaterial color="#C7FF2F" opacity={0.2} transparent />
      </mesh>
    </group>
  );
}
```

Add a `ReactorWorld` containing:

```tsx
<Grid
  args={[14, 8]}
  cellColor="#8B5CF6"
  cellSize={0.5}
  cellThickness={0.35}
  fadeDistance={12}
  fadeStrength={1.4}
  infiniteGrid={false}
  position={[0, 0, 0]}
  sectionColor="#C7FF2F"
  sectionSize={2.5}
  sectionThickness={0.55}
/>
<mesh position={[0, 0.04, 0]}>
  <boxGeometry args={[7.2, 0.06, 0.72]} />
  <meshStandardMaterial color="#050507" metalness={0.9} roughness={0.3} />
</mesh>
<ScanPlane animate={animate} />
{nodes.map((node) => (
  <MarketBlade
    key={node.id}
    active={node.id === activeMarketId}
    animate={animate}
    node={node}
    onActiveMarketChange={onActiveMarketChange}
  />
))}
<Sparkles
  color="#E9F1E2"
  count={38}
  opacity={0.36}
  scale={[11, 5, 7]}
  size={0.8}
  speed={animate ? 0.12 : 0}
/>
```

Use the existing `worldRef` pointer damping with maximum rotation of `0.045`
radians, not the former orbital animation.

- [ ] **Step 4: Recompose `Canvas` and the selected-market DOM overlay**

Keep `Canvas` `aria-hidden`, DPR `[1, 1.5]`, high-performance alpha WebGL, and
`frameloop={shouldAnimate ? 'always' : 'demand'}`. Use:

```tsx
camera={{ position: [0, 5.4, 9.4], fov: 38 }}
onCreated={({ camera }) => camera.lookAt(0, 1.1, 0)}
```

Use ambient intensity `0.34`, a Toxic key light at `[2, 7, 4]`, a Plasma fill
at `[-5, 3, 1]`, and a Rekt rim at `[4, 1, -3]`. Replace “Active body” with:

```typescript
const activeReadoutStyle = css({
  position: 'absolute',
  insetInlineStart: { base: '4', md: '6' },
  bottom: { base: '4', md: '6' },
  minW: { base: '56', md: '72' },
  p: '4',
  pointerEvents: 'none',
  bgColor: 'rgba(5, 5, 7, 0.82)',
  backdropFilter: 'blur(10px)',
  borderInlineStartWidth: '2px',
  borderColor: 'toxic',
});
const readoutLabelStyle = css({
  color: 'bone/46',
  fontFamily: 'mono',
  fontSize: '2xs',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
});
const readoutSymbolStyle = css({
  mt: '2',
  fontFamily: 'display',
  fontSize: { base: '4xl', md: '6xl' },
  fontWeight: '800',
  letterSpacing: '-0.08em',
  lineHeight: '0.9',
});
const readoutValueStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  mt: '3',
  fontFamily: 'mono',
  fontSize: { base: 'sm', md: 'md' },
});
```

```tsx
<div role="status" aria-live="polite" className={activeReadoutStyle}>
  <p className={readoutLabelStyle}>Active market / USD</p>
  <p className={readoutSymbolStyle}>{selectedMarket?.symbol ?? '—'}</p>
  <p className={readoutValueStyle}>
    {formatMarketPrice(selectedMarket?.currentPrice)}
    <span style={{ color: changeTone(selectedMarket?.priceChangePercentage24h) }}>
      {formatMarketChange(selectedMarket?.priceChangePercentage24h)}
    </span>
  </p>
</div>
```

- [ ] **Step 5: Replace the planetary CSS fallback**

Render ten deterministic bars rather than a core/ring/orbit. Each fallback bar
must include `data-testid="reactor-fallback-blade"`, use the existing
`MARKET_COIN_IDS`, alternate row placement, and vary height from `24%` to `72%`.
The shell uses Void, a Plasma depth wash, a center trench, clipped corners, and
no circles.

- [ ] **Step 6: Run scene tests and verify GREEN**

Run the command from Step 2.

Expected: PASS; no orbital props, icosahedron, or cylindrical token geometry remains.

- [ ] **Step 7: Commit the reactor**

```bash
git add apps/dapp/src/_pages/home/ui/market-scene.tsx apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx apps/dapp/src/_pages/home/ui/market-scene-shell.ts apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx
git commit -m "feat(dapp): replace market orbit with liquidity reactor"
```

---

### Task 4: Apply The Degen Visual System And Responsive Density

**Files:**
- Modify: `apps/dapp/app/layout.tsx`
- Modify: `apps/dapp/panda.config.ts`
- Modify: `apps/dapp/src/_pages/home/ui/home-page.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-dashboard.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-header.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-watchlist.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-metrics.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-table.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-state.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-scene.tsx`
- Generated by command: `apps/dapp/src/styled-system/**`
- Test: `apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx`

**Interfaces:**
- Consumes: Task 2 semantic composition and Task 3 reactor.
- Produces: one coherent tokenized desktop/mobile design without changing data or state APIs.

- [ ] **Step 1: Add failing semantic assertions that guard the redesign hierarchy**

Add to the successful dashboard test:

```typescript
expect(screen.getByLabelText('Market tape')).toBeTruthy();
expect(screen.getByRole('region', { name: 'Market watch' })).toBeTruthy();
expect(screen.getByRole('region', { name: 'Market pulse' })).toBeTruthy();
expect(screen.getByText('Selected cap')).toBeTruthy();
expect(screen.getByText('24h volume')).toBeTruthy();
expect(screen.queryByText('Market cap controls mass. Momentum controls glow.')).toBeNull();
```

- [ ] **Step 2: Run the dashboard test and verify RED**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-dashboard.test.tsx
```

Expected: FAIL until the compact metric rail and named reactor region exist.

- [ ] **Step 3: Verify the approved Panda palette and font-role tokens**

Keep the tokens introduced in Task 2 exactly as follows:

```typescript
tokens: {
  colors: {
    void: { value: '#050507' },
    carbon: { value: '#0A0D0B' },
    bone: { value: '#E9F1E2' },
    toxic: { value: '#C7FF2F' },
    plasma: { value: '#8B5CF6' },
    rekt: { value: '#FF3B5C' },
  },
  fonts: {
    display: { value: 'var(--font-display), ui-sans-serif, system-ui, sans-serif' },
    sans: { value: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif' },
    mono: { value: 'var(--font-mono), ui-monospace, monospace' },
  },
}
```

Do not remove the existing semantic tokens used by other dapp routes. This is a
verification step; change `panda.config.ts` only if the implementation differs
from the listed values.

- [ ] **Step 4: Load only approved font weights in the server root layout**

Replace Open Sans with:

```typescript
import { IBM_Plex_Mono, Manrope, Unbounded } from 'next/font/google';

const fontDisplay = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '800'],
});
const fontSans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});
const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});
```

Apply all three variables to `<body>` with `cx` while retaining the existing
server layout, metadata, JSON-LD, providers, and sans body role.

- [ ] **Step 5: Regenerate Panda output through the supported command**

```bash
pnpm --filter @apps/dapp prepare
```

Expected: Panda codegen succeeds; only generated `styled-system` output changes.

- [ ] **Step 6: Complete the responsive visual pass**

Apply these exact structural rules:

- Page: Void background, one Plasma radial wash at the upper right, sparse
  one-pixel coordinate marks, `maxW: '1800px'`, desktop padding `6`, and no
  repeating cyan page grid.
- Header: three desktop columns, one-pixel separators, `minH: '20'`, responsive
  tape overflow, no large marketing paragraph, no pill container around the
  whole header.
- Reactor/watchlist: one shared desktop height of `clamp(34rem, 62vh, 46rem)`;
  watchlist scrolls internally if necessary; tablet watchlist becomes a
  horizontal strip; mobile reactor height is `28rem`.
- Metric rail: `aria-label="Market pulse"`, four compact cells separated by
  rules, labels `Selected cap`, `24h volume`, `Momentum leader`, and `Breadth`;
  two columns on mobile and four on desktop.
- Table: Carbon surface, clipped corners, tighter rows, rank column, Toxic active
  rule, Bone/alpha separators, IBM Plex Mono numeric cells, and existing
  semantic headings/controls.
- States: neutral skeletons match the final terminal geometry; stale/error use
  Rekt border and text plus existing safe copy/retry behavior.
- Motion: use one CSS reveal on the terminal shell and remove unrelated hover
  scaling; wrap it in `@media (prefers-reduced-motion: reduce)` through Panda's
  motion-reduce condition or a global CSS rule.

- [ ] **Step 7: Run focused UI tests and architecture checks**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-dashboard.test.tsx src/__test__/_pages/home/ui/market-watchlist.test.tsx src/__test__/_pages/home/ui/market-scene.test.tsx
pnpm --filter @apps/dapp lint:architecture
pnpm --filter @apps/dapp typecheck
```

Expected: all tests PASS, Steiger has zero warnings, and TypeScript has zero errors.

- [ ] **Step 8: Commit the visual system**

```bash
git add apps/dapp/app/layout.tsx apps/dapp/panda.config.ts apps/dapp/src/styled-system apps/dapp/src/_pages/home/ui/home-page.tsx apps/dapp/src/_pages/home/ui/market-dashboard.tsx apps/dapp/src/_pages/home/ui/market-header.tsx apps/dapp/src/_pages/home/ui/market-watchlist.tsx apps/dapp/src/_pages/home/ui/market-metrics.tsx apps/dapp/src/_pages/home/ui/market-table.tsx apps/dapp/src/_pages/home/ui/market-state.tsx apps/dapp/src/_pages/home/ui/market-scene.tsx apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx
git commit -m "style(dapp): apply degen liquidity terminal design"
```

---

### Task 5: Prove Desktop, Mobile, Data, And Motion Acceptance

**Files:**
- Modify: `apps/dapp/e2e/market-dashboard.test.ts`
- Modify only if browser evidence reveals a defect: Task 2–4 files responsible for that defect.

**Interfaces:**
- Consumes: the completed dashboard and existing deterministic ConnectRPC fixture.
- Produces: browser-level regression coverage and reviewed desktop/mobile screenshots.

- [ ] **Step 1: Add failing browser acceptance tests**

Update the dashboard happy-path expectations and add responsive checks:

```typescript
test('renders the liquidity terminal from the typed ConnectRPC snapshot', async ({
  page,
}) => {
  const marketApi = await installMarketApiMock(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'VIBE//X' })).toBeVisible();
  await expect(page.getByLabel('Market tape')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Market watch' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Select Avalanche' })).toBeInViewport();
  await expect(page.getByRole('region', { name: 'Market pulse' })).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Market matrix' })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(11);
  await expect.poll(marketApi.getRequestCount).toBe(1);
});

test('keeps the mobile terminal usable without page overflow', async ({ page }) => {
  await installMarketApiMock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'VIBE//X' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Market watch' })).toBeVisible();
  await expect(page.getByText('Selected cap')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
```

Retain the existing retry test and update only selectors whose visible copy was
intentionally changed.

- [ ] **Step 2: Run Playwright and verify RED or expose remaining defects**

```bash
pnpm --filter @apps/dapp test:e2e -- e2e/market-dashboard.test.ts
```

Expected before final polish: at least one new viewport/hierarchy assertion
fails. If all pass, retain them as regression coverage and continue to visual
critique.

- [ ] **Step 3: Start the existing dev topology and capture real screenshots**

Use the already-supported command, not a deployment command:

```bash
mise run dev
```

With the local topology healthy, use `agent-browser` against only
`http://localhost:3000` to capture:

- desktop at `1600×1000` after “Market matrix” appears;
- mobile at `390×844` after “Market watch” appears;
- reduced-motion desktop with the browser media emulation enabled.

The real browser network log must show the ConnectRPC POST to the configured API
Gateway and a successful response. Do not mock this manual acceptance pass.

- [ ] **Step 4: Critique and fix the screenshots**

Reject the pass if any of these are visible:

- pastel spheres, cylinders, planetary rings, or an isolated decorative core;
- generic four-card marketing layout;
- more than one dominant glow treatment competing with the reactor;
- truncated values, overlapping status controls, horizontal page overflow, or
  unreadable watchlist rows;
- canvas content obscuring the selected-market DOM readout;
- first viewport failing to show reactor, watchlist, and metric rail at 1600×1000.

Make the smallest responsible CSS/component correction, rerun the focused test,
and recapture the affected viewport after each correction.

- [ ] **Step 5: Run Playwright and verify GREEN**

Run the command from Step 2.

Expected: dashboard and retry tests PASS in Chromium with no console errors.

- [ ] **Step 6: Run all definition-of-done gates**

```bash
mise run typecheck
mise run check:ci
mise run lint
mise run test
mise run build
```

Expected: every command exits zero. Do not run a local deploy command.

- [ ] **Step 7: Commit browser coverage and any final scoped polish**

```bash
git add apps/dapp/e2e/market-dashboard.test.ts apps/dapp/app/layout.tsx apps/dapp/panda.config.ts apps/dapp/src/styled-system apps/dapp/src/_pages/home/model/market-scene.mapper.ts apps/dapp/src/_pages/home/ui/home-page.tsx apps/dapp/src/_pages/home/ui/market-dashboard.tsx apps/dapp/src/_pages/home/ui/market-header.tsx apps/dapp/src/_pages/home/ui/market-watchlist.tsx apps/dapp/src/_pages/home/ui/market-metrics.tsx apps/dapp/src/_pages/home/ui/market-table.tsx apps/dapp/src/_pages/home/ui/market-state.tsx apps/dapp/src/_pages/home/ui/market-scene.tsx apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx apps/dapp/src/_pages/home/ui/market-scene-shell.ts apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-watchlist.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx
git commit -m "test(dapp): cover liquidity terminal experience"
```

- [ ] **Step 8: Report the completed result**

Report the exact commits, focused tests, five repository gates, live ConnectRPC
request result, desktop/mobile/reduced-motion evidence, and any unrelated dirty
worktree files that were deliberately left untouched.
