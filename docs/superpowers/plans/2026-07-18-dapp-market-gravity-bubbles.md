# Dapp Market Gravity Bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the liquidity-canyon scene with a deterministic zero-gravity field of real-logo crypto bubbles and use the same logos throughout the market dashboard.

**Architecture:** Keep ConnectRPC and `TMarket` unchanged. Map markets into deterministic bubble view models, step a small explicit-state physics simulation from one R3F world component, and isolate DOM logos, camera-facing 3D logo billboards, individual bubbles, and the scene shell into focused home Page-slice modules.

> **Browser-QA implementation note (2026-07-18):** The original Task 4
> proposed `TextureLoader`, but CoinGecko's image CDN does not guarantee the
> CORS headers WebGL requires. The final implementation therefore supersedes
> that task's texture snippets with `market-logo-billboard.tsx`: a Drei HTML
> billboard anchored to each simulated group and backed by the tested
> `next/image` `MarketLogo` fallback path. Bubble physics and rendering remain
> in the R3F scene; only the logo pixels use the DOM image pipeline.

**Tech Stack:** Next.js 16/vinext, React 19, TypeScript 6 strict, React Three Fiber 9, Drei 10, Three.js 0.185, Panda CSS, Vitest 4, Testing Library, Playwright, ConnectRPC 2.

## Global Constraints

- Work only in `apps/dapp` and this plan/spec documentation; do not change backend, protocol, ConnectRPC, or query behavior.
- Keep all home-slice imports absolute through `@/`; do not introduce a new FSD layer, widget, package, physics dependency, or WASM payload.
- Bubble radius is logarithmically bounded to `0.48..1.05`; activity is bounded to `0.2..1`; halo intensity is bounded to `0.25..1`.
- Use a fixed `1 / 60` second simulation timestep, at most three substeps per render frame, and stable market-ID hashing; never use `Math.random()`.
- Keep Canvas DPR capped at `1..1.5`; do not add shadows, transmission/refraction, post-processing, remote 3D models, or React state updates inside the frame loop.
- Use `next/image` with explicit dimensions for DOM logos. Missing or failed logos must fall back per coin without failing the scene.
- R3F objects may use Three-native `name`/`userData`; never pass DOM `data-*` attributes to `<group>`, `<mesh>`, materials, or geometries.
- Preserve `MarketSceneFallback`, keyboard-accessible watchlist/table controls, `aria-pressed`, the polite active-market readout, offscreen/hidden-document pausing, and reduced-motion `frameloop="demand"`.
- Preserve unrelated dirty work. Stage and commit only the files listed by the active task.

## File Structure

### Create

- `apps/dapp/src/_pages/home/model/market-gravity.simulation.ts` — explicit-state deterministic attraction, collision, damping, pointer repulsion, and bounds.
- `apps/dapp/src/_pages/home/ui/market-logo.tsx` — reusable `next/image` coin logo with symbol fallback for DOM surfaces.
- `apps/dapp/src/_pages/home/ui/market-logo-billboard.tsx` — pointer-transparent `MarketLogo` billboard anchored to each simulated 3D bubble.
- `apps/dapp/src/_pages/home/ui/market-bubble.tsx` — one sphere, halo, logo disc, and pointer selection surface.
- `apps/dapp/src/_pages/home/ui/market-gravity-world.tsx` — R3F bridge that owns simulation state and Object3D refs.
- `apps/dapp/src/__test__/_pages/home/model/market-gravity.simulation.test.ts` — deterministic physics behavior.
- `apps/dapp/src/__test__/_pages/home/ui/market-logo.test.tsx` — DOM success and failure behavior.
- `apps/dapp/src/__test__/_pages/home/ui/market-table.test.tsx` — real-logo table selection behavior.
- `apps/dapp/src/__test__/_pages/home/ui/market-bubble.test.tsx` — bubble geometry, halo, logo, and click behavior.
- `apps/dapp/src/__test__/_pages/home/ui/market-gravity-world.test.tsx` — simulation bridge, identity preservation, and reduced motion.

### Modify

- `apps/dapp/src/_pages/home/model/market-scene.mapper.ts` — add `TMarketBubbleNode`, then remove legacy blade exports only after scene consumers migrate.
- `apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts` — assert bubble mapping.
- `apps/dapp/src/_pages/home/ui/market-watchlist.tsx` — replace rank token with `MarketLogo`.
- `apps/dapp/src/__test__/_pages/home/ui/market-watchlist.test.tsx` — assert image URL and fallback.
- `apps/dapp/src/_pages/home/ui/market-table.tsx` — replace symbol tile with `MarketLogo`.
- `apps/dapp/next.config.ts` — allow the fixed CoinGecko image CDN host.
- `apps/dapp/src/_pages/home/ui/market-scene.tsx` — reduce to Canvas/readout composition and mount `MarketGravityWorld`.
- `apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx` — replace trench/blades with static logo bubbles.
- `apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx` — replace blade assertions with chamber/readout/fallback assertions.
- `apps/dapp/src/_pages/home/ui/market-dashboard.tsx` — use `mapMarketsToBubbles`.
- `apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx` — use bubble nodes and scene contract.
- `apps/dapp/e2e/fixtures/markets.ts` — provide deterministic logo data URLs in mocked RPC data.
- `apps/dapp/e2e/market-dashboard.test.ts` — assert logos, multi-market selection, console safety, reduced motion, and mobile layout.

---

### Task 1: Map markets into deterministic bubble view models

**Files:**
- Modify: `apps/dapp/src/_pages/home/model/market-scene.mapper.ts`
- Modify: `apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts`

**Interfaces:**
- Consumes: `TMarket` from `@/_pages/home/model/market.schema`.
- Produces: `TMarketBubbleNode`, `TVector3Tuple`, `mapMarketsToBubbles(markets: TMarket[]): TMarketBubbleNode[]`, and the three existing market tone constants.

- [ ] **Step 1: Add failing bubble expectations beside the legacy mapper coverage**

Keep the existing `mapMarketsToScene` tests temporarily so Task 1 remains typecheck-clean. Add fixtures containing real image URLs and a new `describe('[MarketBubbleMapper]')` block that asserts bounded monotonic radii, preserved identity fields, deterministic seeds, safe missing-data defaults, and tone direction:

```ts
import { describe, expect, it } from 'vitest';
import type { TMarket } from '@/_pages/home/model/market.schema';
import {
  MARKET_NEGATIVE_COLOR,
  MARKET_NEUTRAL_COLOR,
  MARKET_POSITIVE_COLOR,
  mapMarketsToBubbles,
  mapMarketsToScene,
} from '@/_pages/home/model/market-scene.mapper';

const markets: TMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    imageUrl: 'https://coin-images.coingecko.com/bitcoin.png',
    marketCap: 1_400_000_000_000,
    totalVolume: 52_000_000_000,
    priceChangePercentage24h: 12,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: 'https://coin-images.coingecko.com/ethereum.png',
    marketCap: 500_000_000_000,
    totalVolume: 19_000_000_000,
    priceChangePercentage24h: -8,
  },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
];

// Keep the existing describe('[MarketSceneMapper]') block here until Task 5.

describe('[MarketBubbleMapper]', () => {
  it('should map real market identity into finite bounded bubbles', () => {
    const nodes = mapMarketsToBubbles(markets);

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({
      id: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'BTC',
      imageUrl: 'https://coin-images.coingecko.com/bitcoin.png',
      haloColor: MARKET_POSITIVE_COLOR,
    });
    expect(nodes[1]?.haloColor).toBe(MARKET_NEGATIVE_COLOR);
    expect(nodes[2]?.haloColor).toBe(MARKET_NEUTRAL_COLOR);
    for (const node of nodes) {
      expect(node.radius).toBeGreaterThanOrEqual(0.48);
      expect(node.radius).toBeLessThanOrEqual(1.05);
      expect(node.mass).toBeCloseTo(node.radius ** 3, 8);
      expect(node.activity).toBeGreaterThanOrEqual(0.2);
      expect(node.activity).toBeLessThanOrEqual(1);
      expect(node.haloIntensity).toBeGreaterThanOrEqual(0.25);
      expect(node.haloIntensity).toBeLessThanOrEqual(1);
      expect(
        [...node.seedPosition, ...node.seedVelocity].every(Number.isFinite),
      ).toBe(true);
    }
    expect(nodes[0]?.radius).toBeGreaterThan(nodes[1]?.radius ?? 0);
  });

  it('should derive deterministic safe values without optional metrics', () => {
    const first = mapMarketsToBubbles([markets[2] as TMarket])[0];
    const second = mapMarketsToBubbles([markets[2] as TMarket])[0];

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      id: 'solana',
      radius: 0.5826,
      activity: 0.344,
      haloColor: MARKET_NEUTRAL_COLOR,
      haloIntensity: 0.25,
    });
  });
});
```

- [ ] **Step 2: Run the mapper test and verify RED**

Run:

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/model/market-scene.mapper.test.ts
```

Expected: FAIL because `mapMarketsToBubbles` and `TMarketBubbleNode` do not exist.

- [ ] **Step 3: Add the deterministic bubble mapper without breaking current consumers**

Retain `TMarketSceneNode` and `mapMarketsToScene` until Task 5. Reuse the file's existing `TMarket` import, tone constants, and `normalizeLogValues` helper; add these exports and stable-hash strategy below the legacy mapper. Round derived values to four decimals so snapshots remain stable:

```ts
export type TVector3Tuple = readonly [number, number, number];

export type TMarketBubbleNode = {
  id: TMarket['id'];
  symbol: string;
  name: string;
  imageUrl?: string;
  radius: number;
  mass: number;
  seedPosition: TVector3Tuple;
  seedVelocity: TVector3Tuple;
  activity: number;
  haloColor: string;
  haloIntensity: number;
};

const MIN_RADIUS = 0.48;
const MAX_RADIUS = 1.05;
const MIN_ACTIVITY = 0.2;
const MAX_ACTIVITY = 1;
const MIN_HALO = 0.25;
const MAX_HALO = 1;
const round = (value: number): number => Math.round(value * 10_000) / 10_000;

const POSITION_SLOTS: readonly TVector3Tuple[] = [
  [-3.2, -1.25, 0],
  [0, 1.25, 0],
  [3.2, -1.25, 0],
  [-1.6, 1.25, 0],
  [1.6, 1.25, 0],
  [0, -1.25, 0],
  [-3.2, 1.25, 0],
  [3.2, 1.25, 0],
  [-1.6, -1.25, 0],
  [1.6, -1.25, 0],
];

const hashUnit = (input: string): number => {
  let hash = 2_166_136_261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85eb_ca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2_ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4_294_967_295;
};

const seededTuple = (id: string, range: TVector3Tuple): TVector3Tuple => [
  round((hashUnit(`x:${id}`) * 2 - 1) * range[0]),
  round((hashUnit(`y:${id}`) * 2 - 1) * range[1]),
  round((hashUnit(`z:${id}`) * 2 - 1) * range[2]),
];

export const mapMarketsToBubbles = (
  markets: TMarket[],
): TMarketBubbleNode[] => {
  const caps = normalizeLogValues(markets, ({ marketCap }) => marketCap);
  const volumes = normalizeLogValues(markets, ({ totalVolume }) => totalVolume);
  const positionById = new Map<TMarket['id'], TVector3Tuple>(
    [...markets]
      .sort(
        (left, right) =>
          (caps.get(right.id) ?? 0.18) - (caps.get(left.id) ?? 0.18) ||
          left.id.localeCompare(right.id),
      )
      .map((market, index): readonly [TMarket['id'], TVector3Tuple] => {
        const slot = POSITION_SLOTS[index] ?? [0, 0, 0];
        return [
          market.id,
          [
            slot[0],
            slot[1],
            round((hashUnit(`depth:${market.id}`) * 2 - 1) * 0.28),
          ],
        ];
      }),
  );

  return markets.map((market) => {
    const cap = caps.get(market.id) ?? 0.18;
    const volume = volumes.get(market.id) ?? 0.18;
    const change = market.priceChangePercentage24h ?? 0;
    const changeMagnitude =
      Math.min(Math.abs(change), MAX_CHANGE_MAGNITUDE) / MAX_CHANGE_MAGNITUDE;
    const radius = round(MIN_RADIUS + cap * (MAX_RADIUS - MIN_RADIUS));

    return {
      id: market.id,
      symbol: market.symbol,
      name: market.name,
      imageUrl: market.imageUrl,
      radius,
      mass: radius ** 3,
      seedPosition: positionById.get(market.id) ?? [0, 0, 0],
      seedVelocity: seededTuple(`${market.id}:velocity`, [0.16, 0.12, 0.08]),
      activity: round(MIN_ACTIVITY + volume * (MAX_ACTIVITY - MIN_ACTIVITY)),
      haloColor:
        change > 0
          ? MARKET_POSITIVE_COLOR
          : change < 0
            ? MARKET_NEGATIVE_COLOR
            : MARKET_NEUTRAL_COLOR,
      haloIntensity: round(MIN_HALO + changeMagnitude * (MAX_HALO - MIN_HALO)),
    };
  });
};
```

If the deterministic safe-default assertion differs because of four-decimal rounding, update only the literal to the value produced by the formulas above; do not weaken the bounded/deterministic assertions.

- [ ] **Step 4: Run the mapper test and typecheck**

Run:

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/model/market-scene.mapper.test.ts
pnpm --filter @apps/dapp typecheck
```

Expected: mapper tests PASS and dapp typecheck reports zero errors because the legacy exports remain available until the atomic consumer migration in Task 5.

- [ ] **Step 5: Commit the mapper slice**

```bash
git add apps/dapp/src/_pages/home/model/market-scene.mapper.ts apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts
git commit -m "refactor(dapp): map markets to gravity bubbles"
```

### Task 2: Add the deterministic zero-gravity simulation

**Files:**
- Create: `apps/dapp/src/_pages/home/model/market-gravity.simulation.ts`
- Create: `apps/dapp/src/__test__/_pages/home/model/market-gravity.simulation.test.ts`

**Interfaces:**
- Consumes: `TMarketBubbleNode`, `TVector3Tuple`, and optional `TMarket['id']`.
- Produces: `TGravityBody`, `TGravitySimulation`, `createGravitySimulation(nodes)`, `syncGravityBodies(simulation, nodes)`, and `advanceGravitySimulation(simulation, input): void`.

- [ ] **Step 1: Write failing simulation tests**

Cover deterministic initialization, no-op deltas, attraction, collision separation, radius-aware bounds, pointer repulsion, and identity-preserving synchronization:

```ts
import { describe, expect, it } from 'vitest';
import {
  advanceGravitySimulation,
  createGravitySimulation,
  syncGravityBodies,
} from '@/_pages/home/model/market-gravity.simulation';
import type { TMarketBubbleNode } from '@/_pages/home/model/market-scene.mapper';

const node = (
  id: TMarketBubbleNode['id'],
  position: readonly [number, number, number],
  radius = 0.6,
): TMarketBubbleNode => ({
  id,
  symbol: id.slice(0, 3).toUpperCase(),
  name: id,
  radius,
  mass: radius ** 3,
  seedPosition: position,
  seedVelocity: [0, 0, 0],
  activity: 0.5,
  haloColor: '#8B5CF6',
  haloIntensity: 0.5,
});

const input = {
  frameDelta: 1 / 60,
  bounds: [4, 2.25, 1.4] as const,
  pointer: { active: false, position: [0, 0, 0] as const },
};

describe('[MarketGravitySimulation]', () => {
  it('should initialize deterministic explicit bodies', () => {
    const nodes = [node('bitcoin', [-2, 0, 0]), node('ethereum', [2, 0, 0])];
    expect(createGravitySimulation(nodes)).toEqual(
      createGravitySimulation(nodes),
    );
  });

  it('should not mutate for zero or negative frame deltas', () => {
    const simulation = createGravitySimulation([node('bitcoin', [2, 0, 0])]);
    const before = structuredClone(simulation);
    advanceGravitySimulation(simulation, { ...input, frameDelta: 0 });
    advanceGravitySimulation(simulation, { ...input, frameDelta: -1 });
    expect(simulation).toEqual(before);
  });

  it('should attract a body toward the chamber center', () => {
    const simulation = createGravitySimulation([node('bitcoin', [2, 0, 0])]);
    advanceGravitySimulation(simulation, input);
    expect(simulation.bodies[0]?.velocity[0]).toBeLessThan(0);
  });

  it('should separate overlapping spheres and keep finite values', () => {
    const simulation = createGravitySimulation([
      node('bitcoin', [0, 0, 0], 0.8),
      node('ethereum', [0.5, 0, 0], 0.8),
    ]);
    advanceGravitySimulation(simulation, input);
    const [bitcoin, ethereum] = simulation.bodies;
    const separation = Math.hypot(
      (ethereum?.position[0] ?? 0) - (bitcoin?.position[0] ?? 0),
      (ethereum?.position[1] ?? 0) - (bitcoin?.position[1] ?? 0),
      (ethereum?.position[2] ?? 0) - (bitcoin?.position[2] ?? 0),
    );
    expect(separation).toBeGreaterThanOrEqual(1.6 - 0.001);
    expect(
      simulation.bodies.flatMap(({ position, velocity }) => [
        ...position,
        ...velocity,
      ]).every(Number.isFinite),
    ).toBe(true);
  });

  it('should contain the full radius inside chamber bounds', () => {
    const simulation = createGravitySimulation([node('bitcoin', [3.9, 0, 0])]);
    advanceGravitySimulation(simulation, input);
    expect(simulation.bodies[0]?.position[0]).toBeLessThanOrEqual(3.4);
  });

  it('should repel a body away from an active pointer', () => {
    const simulation = createGravitySimulation([node('bitcoin', [0.7, 0, 0])]);
    advanceGravitySimulation(simulation, {
      ...input,
      pointer: { active: true, position: [0, 0, 0] },
    });
    expect(simulation.bodies[0]?.velocity[0]).toBeGreaterThan(0);
  });

  it('should preserve body identity and motion when market metrics refresh', () => {
    const simulation = createGravitySimulation([node('bitcoin', [1, 0, 0])]);
    simulation.bodies[0]!.velocity = [0.4, 0.2, 0];
    syncGravityBodies(simulation, [node('bitcoin', [-3, 1, 0], 1)]);
    expect(simulation.bodies[0]).toMatchObject({
      id: 'bitcoin',
      radius: 1,
      position: [1, 0, 0],
      velocity: [0.4, 0.2, 0],
    });
  });
});
```

- [ ] **Step 2: Run the simulation test and verify RED**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/model/market-gravity.simulation.test.ts
```

Expected: FAIL because the simulation module does not exist.

- [ ] **Step 3: Implement explicit-state fixed-step physics**

Use mutable state passed explicitly by the caller, with no mutable module state or browser/Three imports:

```ts
import type { TMarket } from '@/_pages/home/model/market.schema';
import type {
  TMarketBubbleNode,
  TVector3Tuple,
} from '@/_pages/home/model/market-scene.mapper';

type TMutableVector3 = [number, number, number];

export type TGravityBody = {
  id: TMarket['id'];
  radius: number;
  mass: number;
  activity: number;
  position: TMutableVector3;
  velocity: TMutableVector3;
};

export type TGravitySimulation = {
  accumulator: number;
  bodies: TGravityBody[];
};

export type TGravityStepInput = {
  activeMarketId?: TMarket['id'];
  frameDelta: number;
  bounds: TVector3Tuple;
  pointer: { active: boolean; position: TVector3Tuple };
};

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 3;
const MAX_FRAME_DELTA = 1 / 20;
const RESTITUTION = 0.72;
const DAMPING = 0.985;

const bodyFromNode = (node: TMarketBubbleNode): TGravityBody => ({
  id: node.id,
  radius: node.radius,
  mass: node.mass,
  activity: node.activity,
  position: [
    node.seedPosition[0],
    node.seedPosition[1],
    node.seedPosition[2],
  ],
  velocity: [
    node.seedVelocity[0],
    node.seedVelocity[1],
    node.seedVelocity[2],
  ],
});

export const createGravitySimulation = (
  nodes: TMarketBubbleNode[],
): TGravitySimulation => ({
  accumulator: 0,
  bodies: nodes.map(bodyFromNode),
});

export const syncGravityBodies = (
  simulation: TGravitySimulation,
  nodes: TMarketBubbleNode[],
): void => {
  const previous = new Map(simulation.bodies.map((body) => [body.id, body]));
  simulation.bodies = nodes.map((node) => {
    const body = previous.get(node.id);
    if (!body) return bodyFromNode(node);
    body.radius = node.radius;
    body.mass = node.mass;
    body.activity = node.activity;
    return body;
  });
};

const resolveBounds = (body: TGravityBody, bounds: TVector3Tuple): void => {
  for (const axis of [0, 1, 2] as const) {
    const limit = Math.max(0, bounds[axis] - body.radius);
    if (body.position[axis] > limit) {
      body.position[axis] = limit;
      body.velocity[axis] = -Math.abs(body.velocity[axis]) * RESTITUTION;
    } else if (body.position[axis] < -limit) {
      body.position[axis] = -limit;
      body.velocity[axis] = Math.abs(body.velocity[axis]) * RESTITUTION;
    }
  }
};
```

Add the complete step below after `resolveBounds`. It applies center/active attraction, pointer repulsion inside a `1.8`-unit radius, timestep-normalized damping, integration, inverse-mass overlap correction, damped normal impulse, and radius-aware bounds. Coincident centers use `[1, 0, 0]` as the deterministic normal:

```ts
const POINTER_RADIUS = 1.8;
const POINTER_STRENGTH = 3.8;

const step = (
  bodies: TGravityBody[],
  input: TGravityStepInput,
  delta: number,
): void => {
  const damping = DAMPING ** (delta / FIXED_STEP);

  for (const body of bodies) {
    const isActive = body.id === input.activeMarketId;
    const target: TVector3Tuple = isActive ? [0, 0, 0.45] : [0, 0, 0];
    const attraction = isActive ? 0.9 : 0.11;

    for (const axis of [0, 1, 2] as const) {
      body.velocity[axis] +=
        (target[axis] - body.position[axis]) * attraction * delta;
    }

    if (input.pointer.active) {
      const offset: TMutableVector3 = [
        body.position[0] - input.pointer.position[0],
        body.position[1] - input.pointer.position[1],
        body.position[2] - input.pointer.position[2],
      ];
      const distance = Math.hypot(...offset);
      if (distance < POINTER_RADIUS) {
        const normal: TVector3Tuple =
          distance > Number.EPSILON
            ? [offset[0] / distance, offset[1] / distance, offset[2] / distance]
            : [1, 0, 0];
        const strength =
          (1 - distance / POINTER_RADIUS) *
          POINTER_STRENGTH *
          (1 + body.activity * 0.35);
        for (const axis of [0, 1, 2] as const) {
          body.velocity[axis] += normal[axis] * strength * delta;
        }
      }
    }

    for (const axis of [0, 1, 2] as const) {
      body.velocity[axis] *= damping;
      body.position[axis] += body.velocity[axis] * delta;
    }
  }

  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
    const left = bodies[leftIndex];
    if (!left) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < bodies.length;
      rightIndex += 1
    ) {
      const right = bodies[rightIndex];
      if (!right) continue;
      const offset: TMutableVector3 = [
        right.position[0] - left.position[0],
        right.position[1] - left.position[1],
        right.position[2] - left.position[2],
      ];
      const distance = Math.hypot(...offset);
      const minimumDistance = left.radius + right.radius;
      if (distance >= minimumDistance) continue;

      const normal: TVector3Tuple =
        distance > Number.EPSILON
          ? [offset[0] / distance, offset[1] / distance, offset[2] / distance]
          : [1, 0, 0];
      const inverseLeftMass = 1 / Math.max(left.mass, Number.EPSILON);
      const inverseRightMass = 1 / Math.max(right.mass, Number.EPSILON);
      const inverseMassSum = inverseLeftMass + inverseRightMass;
      const overlap = minimumDistance - distance;

      for (const axis of [0, 1, 2] as const) {
        left.position[axis] -=
          normal[axis] * overlap * (inverseLeftMass / inverseMassSum);
        right.position[axis] +=
          normal[axis] * overlap * (inverseRightMass / inverseMassSum);
      }

      const relativeNormalVelocity =
        (right.velocity[0] - left.velocity[0]) * normal[0] +
        (right.velocity[1] - left.velocity[1]) * normal[1] +
        (right.velocity[2] - left.velocity[2]) * normal[2];
      if (relativeNormalVelocity < 0) {
        const impulse =
          (-(1 + RESTITUTION) * relativeNormalVelocity) / inverseMassSum;
        for (const axis of [0, 1, 2] as const) {
          left.velocity[axis] -= impulse * inverseLeftMass * normal[axis];
          right.velocity[axis] += impulse * inverseRightMass * normal[axis];
        }
      }
    }
  }

  for (const body of bodies) resolveBounds(body, input.bounds);
};
```

Finish the module with the accumulator entrypoint:

```ts
export const advanceGravitySimulation = (
  simulation: TGravitySimulation,
  input: TGravityStepInput,
): void => {
  if (!Number.isFinite(input.frameDelta) || input.frameDelta <= 0) return;
  simulation.accumulator += Math.min(input.frameDelta, MAX_FRAME_DELTA);

  let substeps = 0;
  while (simulation.accumulator >= FIXED_STEP && substeps < MAX_SUBSTEPS) {
    step(simulation.bodies, input, FIXED_STEP);
    simulation.accumulator -= FIXED_STEP;
    substeps += 1;
  }

  if (substeps === MAX_SUBSTEPS) {
    simulation.accumulator = Math.min(simulation.accumulator, FIXED_STEP);
  }
};
```

- [ ] **Step 4: Run tests, add edge cases until GREEN, and check formatting**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/model/market-gravity.simulation.test.ts src/__test__/_pages/home/model/market-scene.mapper.test.ts
pnpm --filter @apps/dapp typecheck
pnpm exec biome check apps/dapp/src/_pages/home/model/market-gravity.simulation.ts apps/dapp/src/__test__/_pages/home/model/market-gravity.simulation.test.ts
```

Expected: all focused tests PASS, dapp typecheck reports zero errors, and Biome reports no changes required.

- [ ] **Step 5: Commit the physics model**

```bash
git add apps/dapp/src/_pages/home/model/market-gravity.simulation.ts apps/dapp/src/__test__/_pages/home/model/market-gravity.simulation.test.ts
git commit -m "feat(dapp): add deterministic bubble physics"
```

### Task 3: Render real logos on DOM market surfaces

**Files:**
- Create: `apps/dapp/src/_pages/home/ui/market-logo.tsx`
- Create: `apps/dapp/src/__test__/_pages/home/ui/market-logo.test.tsx`
- Create: `apps/dapp/src/__test__/_pages/home/ui/market-table.test.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-watchlist.tsx`
- Modify: `apps/dapp/src/__test__/_pages/home/ui/market-watchlist.test.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-table.tsx`
- Modify: `apps/dapp/next.config.ts`

**Interfaces:**
- Consumes: `{ imageUrl?: string; name: string; size: 24 | 28 | 32 | 40; symbol: string }`.
- Produces: `MarketLogo`, a decorative explicit-size image with per-URL fallback; watchlist/table behavior remains unchanged.

- [ ] **Step 1: Write failing logo and consumer tests**

Mock `next/image` only at its rendering boundary and test behavior rather than its internal loader:

```tsx
vi.mock('next/image', () => ({
  default: ({ alt, onError, src, ...props }: React.ComponentProps<'img'>) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image.
    <img alt={alt} onError={onError} src={String(src)} {...props} />
  ),
}));

it('should render a decorative fixed-size market logo', () => {
  const { container } = render(
    <MarketLogo
      imageUrl="https://coin-images.coingecko.com/bitcoin.png"
      name="Bitcoin"
      size={32}
      symbol="BTC"
    />,
  );
  const image = container.querySelector('img');
  expect(image).toMatchObject({ alt: '', width: 32, height: 32 });
});

it('should isolate image failure to a symbol fallback', () => {
  const { container } = render(
    <MarketLogo
      imageUrl="https://coin-images.coingecko.com/bitcoin.png"
      name="Bitcoin"
      size={32}
      symbol="BTC"
    />,
  );
  fireEvent.error(container.querySelector('img') as HTMLImageElement);
  expect(screen.getByText('BT')).toBeTruthy();
});
```

Add `imageUrl` to watchlist/table fixtures. Assert each selection button contains one image when supplied, still exposes its accessible name/`aria-pressed`, and shows the first two symbol characters after `fireEvent.error`.

- [ ] **Step 2: Run the three UI test files and verify RED**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-logo.test.tsx src/__test__/_pages/home/ui/market-watchlist.test.tsx src/__test__/_pages/home/ui/market-table.test.tsx
```

Expected: FAIL because `MarketLogo` and the table test contract do not exist.

- [ ] **Step 3: Implement `MarketLogo` with URL-keyed failure state**

```tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';
import { css, cx } from '@/styled-system/css';

type TMarketLogoProps = {
  className?: string;
  imageUrl?: string;
  name: string;
  size: 24 | 28 | 32 | 40;
  symbol: string;
};

const logoFrameStyle = css({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  overflow: 'hidden',
  color: 'bone',
  bgColor: 'void',
  borderWidth: '1px',
  borderColor: 'bone/18',
  borderRadius: 'full',
  boxShadow: 'inset 0 0 16px rgba(233,241,226,0.08)',
});

export function MarketLogo({
  className,
  imageUrl,
  name,
  size,
  symbol,
}: TMarketLogoProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string>();
  const showImage = Boolean(imageUrl && failedImageUrl !== imageUrl);

  return (
    <span
      aria-hidden="true"
      className={cx(logoFrameStyle, className)}
      style={{ width: size, height: size }}
      title={name}
    >
      {showImage ? (
        <Image
          alt=""
          height={size}
          onError={() => setFailedImageUrl(imageUrl)}
          sizes={`${size}px`}
          src={imageUrl as string}
          width={size}
        />
      ) : (
        <span className={css({ fontFamily: 'var(--font-mono)', fontSize: '2xs', fontWeight: '600' })}>
          {symbol.slice(0, 2)}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Integrate logos into watchlist/table and allow only the CoinGecko CDN**

In the watchlist, change the first grid column from the numeric rank to `<MarketLogo imageUrl={market.imageUrl} name={market.name} size={32} symbol={market.symbol} />`. Keep the list order and existing visible symbol/name/price/change.

In `AssetButton`, replace the clipped symbol tile with:

```tsx
<MarketLogo
  className={active ? activeTokenStyle : undefined}
  imageUrl={market.imageUrl}
  name={market.name}
  size={32}
  symbol={market.symbol}
/>
```

Change `activeTokenStyle` to a ring/box-shadow style that does not replace the logo image with a solid fill.

In `next.config.ts`, prepend the fixed market-image host while preserving environment-provided hosts:

```ts
remotePatterns: [
  { protocol: 'https', hostname: 'coin-images.coingecko.com' },
  ...(env.server.CORS_RESOURCE?.split(',').map((remote) => ({
    hostname: remote,
  })) ?? []),
],
```

- [ ] **Step 5: Run focused tests, dapp typecheck, and Biome**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-logo.test.tsx src/__test__/_pages/home/ui/market-watchlist.test.tsx src/__test__/_pages/home/ui/market-table.test.tsx
pnpm --filter @apps/dapp typecheck
pnpm exec biome check apps/dapp/src/_pages/home/ui/market-logo.tsx apps/dapp/src/_pages/home/ui/market-watchlist.tsx apps/dapp/src/_pages/home/ui/market-table.tsx apps/dapp/next.config.ts
```

Expected: focused tests PASS, dapp typecheck reports zero errors, and Biome is clean.

- [ ] **Step 6: Commit DOM logo integration**

```bash
git add apps/dapp/next.config.ts apps/dapp/src/_pages/home/ui/market-logo.tsx apps/dapp/src/_pages/home/ui/market-watchlist.tsx apps/dapp/src/_pages/home/ui/market-table.tsx apps/dapp/src/__test__/_pages/home/ui/market-logo.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-watchlist.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-table.test.tsx
git commit -m "feat(dapp): render real market logos"
```

### Task 4: Build isolated WebGL logo discs and market bubbles

**Files:**
- Create: `apps/dapp/src/_pages/home/ui/market-logo-texture.tsx`
- Create: `apps/dapp/src/_pages/home/ui/market-bubble.tsx`
- Create: `apps/dapp/src/__test__/_pages/home/ui/market-logo-texture.test.tsx`
- Create: `apps/dapp/src/__test__/_pages/home/ui/market-bubble.test.tsx`

**Interfaces:**
- Consumes: `TMarketBubbleNode`, `active`, `objectRef`, and `onActiveMarketChange`.
- Produces: `MarketLogoTexture` and `MarketBubble`; one Three-native named group per market.

- [ ] **Step 1: Write failing WebGL logo tests**

Mock the canvas context and `TextureLoader` so the tests verify isolation without requesting the network:

```tsx
it('should create a local symbol texture when no image URL exists', () => {
  const texture = createSymbolLogoTexture('BTC');
  expect(texture.colorSpace).toBe(SRGBColorSpace);
  expect(texture.image.width).toBe(128);
  texture.dispose();
});

it('should keep the symbol disc when the remote logo loader fails', () => {
  textureLoaderMocks.fail = true;
  const { container } = render(
    <MarketLogoTexture
      imageUrl="https://coin-images.coingecko.com/bitcoin.png"
      radius={0.6}
      symbol="BTC"
    />,
  );
  expect(container.querySelector('mesh[name="market-logo-BTC"]')).toBeTruthy();
  expect(textureLoaderMocks.errors).toHaveLength(1);
});
```

Write the bubble test with R3F event mocks. Assert `sphereGeometry` exists, no `boxGeometry`/lane/trench node exists, the halo and logo names exist, no R3F element has a DOM `data-*` attribute, and clicking the Ethereum shell calls `onActiveMarketChange('ethereum')`.

- [ ] **Step 2: Run both tests and verify RED**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-logo-texture.test.tsx src/__test__/_pages/home/ui/market-bubble.test.tsx
```

Expected: FAIL because both UI modules are missing.

- [ ] **Step 3: Implement the symbol texture and isolated remote load**

`createSymbolLogoTexture` must make a `128x128` `CanvasTexture`, draw a dark circular background and centered uppercase two-character symbol, and set `SRGBColorSpace`. `MarketLogoTexture` owns a `MeshBasicMaterial` ref and applies textures imperatively so remote load failure cannot throw through the scene:

```tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  MeshBasicMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';

export const createSymbolLogoTexture = (symbol: string): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#080A0B';
    context.beginPath();
    context.arc(64, 64, 62, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#E9F1E2';
    context.font = '700 38px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(symbol.slice(0, 2).toUpperCase(), 64, 66);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

export function MarketLogoTexture({ imageUrl, radius, symbol }: {
  imageUrl?: string;
  radius: number;
  symbol: string;
}) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const fallback = useMemo(() => createSymbolLogoTexture(symbol), [symbol]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    let disposed = false;
    let remoteTexture: Texture | undefined;
    material.map = fallback;
    material.needsUpdate = true;

    if (imageUrl) {
      new TextureLoader()
        .setCrossOrigin('anonymous')
        .load(
          imageUrl,
          (texture) => {
            if (disposed) {
              texture.dispose();
              return;
            }
            texture.colorSpace = SRGBColorSpace;
            remoteTexture = texture;
            material.map = texture;
            material.needsUpdate = true;
          },
          undefined,
          () => {
            if (!disposed) {
              material.map = fallback;
              material.needsUpdate = true;
            }
          },
        );
    }

    return () => {
      disposed = true;
      remoteTexture?.dispose();
      material.map = null;
    };
  }, [fallback, imageUrl]);

  useEffect(() => () => fallback.dispose(), [fallback]);

  return (
    <mesh name={`market-logo-${symbol}`} position={[0, 0, radius * 1.015]}>
      <circleGeometry args={[radius * 0.52, 48]} />
      <meshBasicMaterial ref={materialRef} toneMapped={false} transparent />
    </mesh>
  );
}
```

- [ ] **Step 4: Implement the focused bubble component**

Use one group ref for world positioning. Keep hover state local and outside the world simulation:

```tsx
'use client';

import { useState } from 'react';
import { BackSide } from 'three';
import type { Group } from 'three';
import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketBubbleNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketLogoTexture } from '@/_pages/home/ui/market-logo-texture';

export function MarketBubble({ active, node, objectRef, onActiveMarketChange }: {
  active: boolean;
  node: TMarketBubbleNode;
  objectRef: (object: Group | null) => void;
  onActiveMarketChange: (marketId: TMarket['id']) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  return (
    <group
      ref={objectRef}
      name={`market-bubble-${node.id}`}
      scale={highlighted ? 1.06 : 1}
    >
      <mesh
        name={`market-bubble-shell-${node.id}`}
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
        <sphereGeometry args={[node.radius, 48, 32]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.12}
          color="#090D12"
          emissive={node.haloColor}
          emissiveIntensity={highlighted ? 0.18 : 0.06}
          metalness={0.36}
          opacity={0.82}
          roughness={0.18}
          transparent
        />
      </mesh>
      <mesh name={`market-halo-${node.id}`} scale={1.1}>
        <sphereGeometry args={[node.radius, 32, 20]} />
        <meshBasicMaterial
          color={node.haloColor}
          depthWrite={false}
          opacity={node.haloIntensity * (highlighted ? 0.22 : 0.09)}
          side={BackSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <MarketLogoTexture
        imageUrl={node.imageUrl}
        radius={node.radius}
        symbol={node.symbol}
      />
    </group>
  );
}
```

- [ ] **Step 5: Run focused tests, typecheck, and Biome**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-logo-texture.test.tsx src/__test__/_pages/home/ui/market-bubble.test.tsx
pnpm --filter @apps/dapp typecheck
pnpm exec biome check apps/dapp/src/_pages/home/ui/market-logo-texture.tsx apps/dapp/src/_pages/home/ui/market-bubble.tsx apps/dapp/src/__test__/_pages/home/ui/market-logo-texture.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-bubble.test.tsx
```

Expected: focused tests PASS and touched files are clean.

- [ ] **Step 6: Commit the WebGL bubble units**

```bash
git add apps/dapp/src/_pages/home/ui/market-logo-texture.tsx apps/dapp/src/_pages/home/ui/market-bubble.tsx apps/dapp/src/__test__/_pages/home/ui/market-logo-texture.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-bubble.test.tsx
git commit -m "feat(dapp): build 3d market bubbles"
```

### Task 5: Compose the gravity world, scene shell, and static fallback

**Files:**
- Create: `apps/dapp/src/_pages/home/ui/market-gravity-world.tsx`
- Create: `apps/dapp/src/__test__/_pages/home/ui/market-gravity-world.test.tsx`
- Modify: `apps/dapp/src/_pages/home/model/market-scene.mapper.ts`
- Modify: `apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts`
- Modify: `apps/dapp/src/_pages/home/ui/market-scene.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx`
- Modify: `apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx`
- Modify: `apps/dapp/src/_pages/home/ui/market-dashboard.tsx`
- Modify: `apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx`

**Interfaces:**
- Consumes: `TMarketBubbleNode[]`, activity policy, selected market ID, and selection callback.
- Produces: `MarketGravityWorld`; `MarketScene` public props remain structurally the same except `nodes` becomes `TMarketBubbleNode[]`.

- [ ] **Step 1: Write failing gravity-world and scene tests**

Mock `MarketBubble` as a Three-like `group` whose `name` is `market-bubble-${node.id}`, and capture the one `useFrame` callback. Assert:

```tsx
expect(container.querySelectorAll('group[name^="market-bubble-"]')).toHaveLength(
  nodes.length,
);
expect(container.querySelector('[name^="liquidity-lane-"]')).toBeNull();
expect(container.querySelector('[name="liquidity-scan"]')).toBeNull();
expect(container.querySelector('boxGeometry')).toBeNull();
```

Invoke the frame callback twice and assert Object3D refs receive finite positions. Rerender with a different `activeMarketId` and assert body object identity/position is preserved. With `animate={false}`, invoke the callback and assert refs do not move.

In `market-scene.test.tsx`, change copy/geometry expectations to:

```tsx
expect(screen.getByRole('region', { name: 'Market gravity chamber' })).toBeTruthy();
expect(r3fMocks.canvasProps?.dpr).toEqual([1, 1.5]);
expect(r3fMocks.canvasProps?.frameloop).toBe('always');
expect(r3fMocks.canvasProps?.camera).toEqual({
  fov: 42,
  position: [0, 0, 10.8],
});
expect(screen.getByRole('status').textContent).toContain('BTC');
expect(container.querySelector('[name="market-gravity-world"]')).toBeTruthy();
```

For compact viewport, expect `{ fov: 48, position: [0, 0, 12.8] }`. For fallback, expect ten `gravity-fallback-bubble` elements and no `reactor-fallback-blade`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home/ui/market-gravity-world.test.tsx src/__test__/_pages/home/ui/market-scene.test.tsx src/__test__/_pages/home/ui/market-dashboard.test.tsx
```

Expected: FAIL because the world is missing and the scene still renders the canyon.

- [ ] **Step 3: Implement the R3F simulation bridge**

`MarketGravityWorld` must own refs and never call a state setter from `useFrame`:

```tsx
'use client';

import { Sparkles } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import {
  advanceGravitySimulation,
  createGravitySimulation,
  syncGravityBodies,
} from '@/_pages/home/model/market-gravity.simulation';
import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketBubbleNode, TVector3Tuple } from '@/_pages/home/model/market-scene.mapper';
import { MarketBubble } from '@/_pages/home/ui/market-bubble';

const SIMULATION_BOUNDS = [4.25, 2.35, 1.35] as const;

export function MarketGravityWorld({
  activeMarketId,
  animate,
  compactViewport,
  nodes,
  onActiveMarketChange,
}: {
  activeMarketId?: TMarket['id'];
  animate: boolean;
  compactViewport: boolean;
  nodes: TMarketBubbleNode[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
}) {
  const simulationRef = useRef(createGravitySimulation(nodes));
  const bubbleRefs = useRef(new Map<TMarket['id'], Group>());
  const pointerActiveRef = useRef(false);
  const { gl } = useThree();

  useEffect(() => {
    syncGravityBodies(simulationRef.current, nodes);
    for (const body of simulationRef.current.bodies) {
      bubbleRefs.current.get(body.id)?.position.set(...body.position);
    }
  }, [nodes]);

  useEffect(() => {
    const activatePointer = () => {
      pointerActiveRef.current = true;
    };
    const deactivatePointer = () => {
      pointerActiveRef.current = false;
    };
    gl.domElement.addEventListener('pointermove', activatePointer, {
      passive: true,
    });
    gl.domElement.addEventListener('pointerleave', deactivatePointer);
    return () => {
      gl.domElement.removeEventListener('pointermove', activatePointer);
      gl.domElement.removeEventListener('pointerleave', deactivatePointer);
    };
  }, [gl]);

  useFrame(({ pointer }, delta) => {
    if (!animate) return;
    const pointerPosition: TVector3Tuple = [
      pointer.x * SIMULATION_BOUNDS[0],
      pointer.y * SIMULATION_BOUNDS[1],
      0.4,
    ];
    advanceGravitySimulation(simulationRef.current, {
      activeMarketId,
      bounds: SIMULATION_BOUNDS,
      frameDelta: delta,
      pointer: {
        active: pointerActiveRef.current,
        position: pointerPosition,
      },
    });
    for (const body of simulationRef.current.bodies) {
      bubbleRefs.current.get(body.id)?.position.set(...body.position);
    }
  });

  return (
    <group
      name="market-gravity-world"
      scale={compactViewport ? 0.74 : 1}
    >
      {nodes.map((node) => (
        <MarketBubble
          key={node.id}
          active={node.id === activeMarketId}
          node={node}
          objectRef={(object) => {
            if (!object) {
              bubbleRefs.current.delete(node.id);
              return;
            }
            bubbleRefs.current.set(node.id, object);
            const body = simulationRef.current.bodies.find(
              ({ id }) => id === node.id,
            );
            if (body) object.position.set(...body.position);
          }}
          onActiveMarketChange={onActiveMarketChange}
        />
      ))}
      <mesh name="market-orbit-primary" rotation={[1.2, 0.18, 0.36]}>
        <torusGeometry args={[3.2, 0.006, 8, 96]} />
        <meshBasicMaterial
          color="#8B5CF6"
          depthWrite={false}
          opacity={0.22}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh name="market-orbit-secondary" rotation={[1.42, -0.34, -0.2]}>
        <torusGeometry args={[2.45, 0.004, 8, 96]} />
        <meshBasicMaterial
          color="#C7FF2F"
          depthWrite={false}
          opacity={0.12}
          toneMapped={false}
          transparent
        />
      </mesh>
      <Sparkles
        color="#E9F1E2"
        count={28}
        opacity={0.2}
        scale={compactViewport ? [7, 8, 3] : [10, 6, 4]}
        size={0.5}
        speed={animate ? 0.08 : 0}
      />
    </group>
  );
}
```

The DOM listener is intentional: R3F's normalized pointer starts at `[0, 0]`, so deriving activity from coordinates would create a permanent repulsion source before the user ever enters the Canvas. Extend the world test to dispatch `pointermove`/`pointerleave` on the mocked `gl.domElement` and assert the simulation input toggles accordingly. The `objectRef` callback and `[nodes]` effect must both apply body positions so `animate={false}` never stacks every bubble at the origin.

- [ ] **Step 4: Replace the canyon scene with the chamber composition**

Delete `MarketBlade`, `ScanPlane`, `ActiveMarketBeam`, `LiquidityLane`, `Grid`, `RoundedBox`, `Edges`, lane constants, and every box/trench/scan node from `market-scene.tsx`. Keep Canvas dynamically client-only through the existing loader.

Mount `MarketGravityWorld`, set the region label to `Market gravity chamber`, use the exact cameras in Step 1, retain DPR/fallback/activity policy, and use only restrained ambient plus three point lights. Add `<MarketLogo size={40} ... />` to the active readout beside its symbol, without changing the polite status semantics.

Update `MarketSceneFallback` to accept optional `{ activeMarketId, markets, nodes }`. When real props are present, render one absolutely positioned circular item per node, sized from `radius`, containing `<MarketLogo>` plus the visible market name, using deterministic seed X/Y mapped to CSS percentages and active ring styling. Use `data-testid="gravity-fallback-bubble"` on these DOM fallback elements only. Keep a local ten-item `[id, symbol]` tuple aligned with `MARKET_COIN_IDS` for `market-scene-loader.tsx`'s prop-less dynamic loading state; the Canvas `fallback` must pass the real `{ activeMarketId, markets, nodes }` so WebGL initialization failure satisfies the real-logo fallback contract.

In `MarketDashboard`, replace:

```ts
const sceneNodes = useMemo(() => mapMarketsToScene(markets), [markets]);
```

with:

```ts
const sceneNodes = useMemo(() => mapMarketsToBubbles(markets), [markets]);
```

After `MarketDashboard`, `MarketScene`, and their tests use the bubble mapper, delete the legacy `TMarketSceneNode`, `mapMarketsToScene`, blade dimension constants, and their old assertions from `market-scene.mapper.ts` and its test. This deletion happens in the same commit as the consumer migration so every task boundary stays typecheck-clean.

- [ ] **Step 5: Run the entire home slice and architecture checks**

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/_pages/home
pnpm --filter @apps/dapp typecheck
pnpm --filter @apps/dapp lint:architecture
pnpm exec biome check apps/dapp/src/_pages/home apps/dapp/src/__test__/_pages/home
```

Expected: home tests PASS, dapp typecheck reports zero errors, Steiger reports no problems, and Biome is clean for the home slice.

- [ ] **Step 6: Commit the chamber composition**

```bash
git add apps/dapp/src/_pages/home/model/market-scene.mapper.ts apps/dapp/src/_pages/home/ui/market-gravity-world.tsx apps/dapp/src/_pages/home/ui/market-scene.tsx apps/dapp/src/_pages/home/ui/market-scene-fallback.tsx apps/dapp/src/_pages/home/ui/market-dashboard.tsx apps/dapp/src/__test__/_pages/home/model/market-scene.mapper.test.ts apps/dapp/src/__test__/_pages/home/ui/market-gravity-world.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-scene.test.tsx apps/dapp/src/__test__/_pages/home/ui/market-dashboard.test.tsx
git commit -m "feat(dapp): compose market gravity chamber"
```

### Task 6: Prove real-logo behavior and runtime quality in the browser

**Files:**
- Modify: `apps/dapp/e2e/fixtures/markets.ts`
- Modify: `apps/dapp/e2e/market-dashboard.test.ts`

**Interfaces:**
- Consumes: the completed dashboard and its existing ConnectRPC fixture interception.
- Produces: deterministic browser coverage for logos, selection, reduced motion, no runtime errors, and mobile overflow.

- [ ] **Step 1: Add deterministic logo data to the RPC fixture**

Define a fixture-safe SVG URL helper before `MARKET_RESPONSE`:

```ts
const logoDataUrl = (symbol: string, color: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="${color}"/><text x="32" y="38" text-anchor="middle" fill="#050507" font-family="monospace" font-size="18" font-weight="700">${symbol}</text></svg>`,
  )}`;
```

Add a distinct `imageUrl: logoDataUrl('BTC', '#F7931A')`-style value to every fixture market. Keep every other RPC field unchanged.

- [ ] **Step 2: Write failing browser assertions**

In the main dashboard test, collect runtime errors before navigation, assert all ten watchlist buttons contain a visible `img`, and select multiple markets:

```ts
const runtimeErrors: Error[] = [];
const consoleErrors: string[] = [];
page.on('pageerror', (error) => runtimeErrors.push(error));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

await page.goto('/');
const watch = page.getByRole('region', { name: 'Market watch' });
await expect(watch.locator('img')).toHaveCount(10);
await watch.getByRole('button', { name: 'Select Ethereum' }).click();
await expect(page.getByRole('status')).toContainText('ETH');
await watch.getByRole('button', { name: 'Select Solana' }).click();
await expect(page.getByRole('status')).toContainText('SOL');
expect(runtimeErrors).toEqual([]);
expect(consoleErrors).toEqual([]);
```

Add a reduced-motion test with `test.use({ reducedMotion: 'reduce' })`. Capture `page.getByRole('region', { name: 'Market gravity chamber' }).screenshot()` twice 900ms apart and require equal buffers. Keep the existing `390x844` overflow assertion and add visibility checks for the chamber and its watchlist logos.

- [ ] **Step 3: Run E2E and verify RED before relying on the fixture**

```bash
pnpm --filter @apps/dapp test:e2e -- e2e/market-dashboard.test.ts
```

Expected before fixture/component completion: at least the ten-logo count or new chamber label assertion FAILS.

- [ ] **Step 4: Resolve only browser-observed integration defects**

If E2E exposes an image-loader incompatibility with `data:` URLs, keep the production `MarketLogo` contract unchanged and serve the fixture SVGs from Playwright route interception using HTTPS fixture URLs. Do not loosen production `remotePatterns` to `**` and do not replace `next/image` with raw `<img>`.

If screenshot equality is affected only by the query devtools button, scope screenshots to the Canvas wrapper inside the chamber. Do not disable physics globally or weaken the equality assertion.

- [ ] **Step 5: Run all definition-of-done gates**

```bash
mise run typecheck
mise run check:ci
mise run lint
mise run test
mise run build
```

Expected: every gate passes for task-owned files. If a repo-wide gate fails only on pre-existing unrelated dirty files, record exact paths and failures, then run and report the equivalent scoped checks for every task-owned file. Do not auto-fix unrelated work.

- [ ] **Step 6: Perform browser visual QA**

Run the real dev topology, open `http://localhost:3000` in a clean browser session, and verify:

```text
Desktop 1600x1000:
- ten complete bubbles are visible across depth;
- BTC/ETH are larger but do not cover smaller coins;
- every visible coin has a crisp logo;
- bubbles collide/drift without tunneling or leaving the chamber;
- hover/click selection remains responsive;
- no canyon blade, lane, trench, scan line, or floor grid remains.

Mobile 390x844:
- page overflow is <= 1px;
- chamber composition remains legible;
- watchlist scroll and logo visibility remain intact.

Reduced motion:
- bubble positions, dust, and traces remain static;
- selection still updates the active visual/readout;
- no page error, R3F error, hydration warning, or texture-loader rejection appears.
```

Capture desktop, mobile, and reduced-motion screenshots under `/tmp` for review; do not commit them.

- [ ] **Step 7: Commit browser regression coverage and any final scoped polish**

```bash
git add apps/dapp/e2e/fixtures/markets.ts apps/dapp/e2e/market-dashboard.test.ts
git commit -m "test(dapp): cover market gravity chamber"
```

## Final Review Checklist

- [ ] Compare the implementation against every acceptance criterion in `docs/superpowers/specs/2026-07-18-dapp-market-gravity-bubbles-design.md`.
- [ ] Search the R3F tree for `data-`, `RoundedBox`, `Grid`, `boxGeometry`, `liquidity-lane`, `liquidity-scan`, `trench`, and `blade`; none may remain in production scene modules.
- [ ] Confirm the real ConnectRPC request still targets the API gateway and `imageUrl` is preserved by validation/mapping.
- [ ] Confirm no package dependency, protocol schema, backend source, or generated code changed.
- [ ] Confirm each task commit contains only its declared files and preserves unrelated dirty work.
