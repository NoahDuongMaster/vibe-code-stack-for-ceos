# Dapp Market Gravity Bubbles Design

**Date:** 2026-07-18
**Status:** Approved in conversation; awaiting written-spec review
**Workspace:** `apps/dapp` (`@apps/dapp`)

## Summary

Replace the current liquidity-canyon WebGL scene with a zero-gravity market
swarm. Each market is represented by a glossy 3D bubble with its real
CoinGecko logo, a market-cap-driven size, and a 24-hour-change halo. The ten
bubbles drift toward the chamber center, collide, react to the pointer, and
keep the selected market in visual focus.

The redesign also replaces symbol placeholders in the watchlist and market
table with the same real coin logos. ConnectRPC and the market-data backend do
not change because `imageUrl` already flows from CoinGecko through the protocol
to the dapp's validated `TMarket` model.

## Goals

- Make the first viewport unmistakably crypto-native and visually alive.
- Show a recognizable real logo for every market whenever `imageUrl` loads.
- Replace blades, lanes, trench, grid, and scan plane with interactive bubbles.
- Make bubble size, energy, and color encode real market properties.
- Preserve selection synchronization between the scene, watchlist, and table.
- Keep the scene performant, deterministic under test, accessible through DOM
  controls, and static when reduced motion is requested.

## Non-goals

- No backend, protocol, ConnectRPC, query, or market-list changes.
- No new physics engine, WASM payload, post-processing stack, or remote 3D
  model.
- No wallet, trading, order-entry, charting, or portfolio functionality.
- No attempt to make the Canvas itself the primary accessible interaction
  surface; the watchlist and table remain the keyboard-accessible controls.
- No redesign of the surrounding `VIBE//X` terminal shell beyond the changes
  required to integrate logos and the new scene language.

## Selected direction

### Motion model

Use a small deterministic physics simulation written in TypeScript. With only
ten bodies, pairwise collision detection is at most 45 checks per simulation
step and does not justify a general-purpose physics dependency.

The selected behavior is a **zero-gravity swarm**:

- a weak spring attracts every bubble toward the chamber center;
- damping produces slow, liquid drift instead of perpetual acceleration;
- overlapping spheres separate and exchange normal velocity;
- chamber bounds keep every bubble visible and apply a softened bounce;
- the pointer creates a local repulsion field;
- the active bubble receives a stronger spring toward a central foreground
  anchor while other bubbles continue to flow around it.

This is intentionally not earth gravity. Nothing drops onto a floor, and the
scene has no visible floor or grid.

### Visual model

The scene is a **Market Gravity Chamber**:

- ten glossy dark-glass spheres float in a deep void;
- each sphere contains a camera-facing circular logo badge;
- radius uses logarithmically normalized market cap;
- drift energy uses logarithmically normalized 24-hour volume;
- the halo is toxic green for positive change, rekt red for negative change,
  and plasma violet for neutral or unavailable change;
- change magnitude controls halo intensity but is capped so outliers do not
  dominate;
- the active bubble grows subtly, moves toward the foreground anchor, and gains
  a crisp outer ring;
- faint dust and restrained orbital traces provide depth without competing with
  the logos.

The composition contains no rectangular blades, lane bases, central trench,
scan line, or floor grid.

## Data mapping

`TMarket.imageUrl` is already optional and URL-validated. The scene mapper will
produce a bubble-specific view model rather than a blade-specific node.

```ts
type TMarketBubbleNode = {
  id: TMarket['id'];
  symbol: string;
  name: string;
  imageUrl?: string;
  radius: number;
  mass: number;
  seedPosition: readonly [number, number, number];
  seedVelocity: readonly [number, number, number];
  activity: number;
  haloColor: string;
  haloIntensity: number;
};
```

Mapping rules:

- radius is mapped from log market cap into `0.48..1.05` scene units;
- mass is proportional to `radius ** 3` so large bubbles feel heavier;
- activity is mapped from log volume into `0.2..1`;
- halo intensity maps capped absolute 24-hour change into `0.25..1`;
- positions and velocities are derived from a stable hash of the market ID,
  never `Math.random()`, so initial layouts are repeatable;
- missing numeric fields use conservative midpoint or minimum values and never
  produce `NaN`, infinity, or a zero-radius body.

Bubble order continues to follow the validated market response. Identity and
physics state are keyed by market ID, so refreshes update presentation without
assigning one coin another coin's body.

## Physics contract

The model module exposes initialization and stepping functions that do not
depend on React, R3F, Three.js objects, browser globals, or mutable module state.

- simulation timestep: fixed `1 / 60` second;
- maximum work per render frame: three substeps;
- oversized frame deltas are clamped before entering the accumulator;
- collision resolution includes overlap correction and a damped normal impulse;
- every completed step must leave finite positions and velocities;
- bounds include each body's radius, ensuring the full logo-bearing sphere
  remains in frame;
- zero or negative elapsed time produces no state mutation;
- active-market changes alter attraction targets without reinitializing bodies.

The R3F layer owns a simulation ref and an Object3D ref per market. `useFrame`
steps the simulation and copies positions/scales to Three refs directly. It
must not call React state setters during the animation loop.

## Logo strategy

### DOM surfaces

The watchlist and market table use one same-slice `MarketLogo` UI component
built with `next/image` and explicit dimensions. The image is decorative inside
controls that already contain the coin name, so it uses an empty `alt` value to
avoid duplicate announcements. Loading failure switches that instance to a
styled symbol fallback.

### WebGL scene

Each bubble contains a billboarded logo disc that always faces the camera. A
per-bubble texture loader requests `imageUrl` with anonymous cross-origin mode.
Successful textures use sRGB color space, preserve aspect ratio, and are
disposed when replaced or unmounted. A failed or missing URL produces a local
symbol texture for that bubble only; it must not reject or suspend the entire
scene.

The sphere uses a restrained physical material treatment: dark translucent
body, clearcoat highlight, low emissive tint, and no expensive transmission,
refraction, shadows, or post-processing. The logo remains readable rather than
being distorted by the sphere material.

## FSD structure

All work stays inside the existing home Page slice. Proposed responsibilities:

```text
apps/dapp/src/_pages/home/
  model/
    market-scene.mapper.ts          market -> bubble view model
    market-gravity.simulation.ts    deterministic physics model
  ui/
    market-scene.tsx                Canvas and DOM readout composition
    market-gravity-world.tsx        R3F simulation bridge and chamber
    market-bubble.tsx               sphere, halo, badge, pointer handlers
    market-logo.tsx                 reusable DOM logo with symbol fallback
    market-scene-fallback.tsx       static logo-bearing bubble composition
    market-watchlist.tsx            consumes MarketLogo
    market-table.tsx                consumes MarketLogo
```

Same-slice imports remain absolute through `@/`. No new FSD layer, widget, or
package is introduced. The home slice Public API remains unchanged.

## Component behavior

### Market bubble

- The sphere is the R3F raycast target.
- Pointer enter marks it highlighted without taking selection ownership.
- Click stops scene propagation and calls `onActiveMarketChange(id)`.
- Highlight changes material/halo only; physics state stays in the world.
- Three objects use supported properties such as `name` and `userData`; DOM
  `data-*` attributes are forbidden inside the R3F tree.

### Scene readout

The current active-market readout remains a DOM overlay and adds the real logo.
It continues to expose price and 24-hour change through `aria-live="polite"`.

### Watchlist and table

Logo placement replaces the numeric/symbol token placeholder without removing
the visible symbol and market name. Focus, hover, click, `aria-pressed`, and
selection synchronization remain unchanged.

## Responsive behavior

- Desktop uses a wide chamber with depth distributed across all three axes.
- Mobile reduces the Z range, slightly compresses the maximum radius, and pulls
  the camera back so every complete sphere can enter the frame.
- The page must retain zero horizontal document overflow at `390px` width.
- The horizontal watchlist remains scrollable and retains its existing
  affordance.
- Logos remain at least 24 CSS pixels in DOM market rows and legible within the
  mobile bubble composition.

## Reduced motion and lifecycle

The existing market-scene activity hook remains the single policy boundary for
motion.

- When reduced motion is enabled, nodes use deterministic seed positions,
  physics does not step, dust and orbital traces do not animate, and the Canvas
  uses `frameloop="demand"`.
- When the scene is outside the viewport or the document is hidden, physics and
  ambient motion pause.
- Resuming continues from the stored state without a large accumulated delta.
- The static WebGL arrangement and DOM fallback preserve the same market-cap
  hierarchy and real logos.

## Error handling

- A single failed logo request affects only that coin and renders its symbol
  fallback.
- Missing `imageUrl` is a supported data condition, not a query failure.
- WebGL initialization failure renders `MarketSceneFallback` with logos,
  names, relative size, and active styling.
- Market query errors continue through the existing generic error/retry state;
  the scene must not reinterpret transport failures as an empty market.
- No raw image-loader or physics error text is rendered to the user.

## Performance budget

- ten simulated bodies and at most 45 pair checks per substep;
- maximum three physics substeps per rendered frame;
- Canvas DPR remains capped at `1..1.5`;
- one shared sphere geometry and one shared ring geometry where material needs
  allow it;
- no shadows, post-processing, physics WASM, remote 3D models, or continuous
  React state updates;
- textures use a bounded logo resolution appropriate for on-screen bubble
  sizes;
- below-the-fold loading behavior remains controlled by the existing dynamic
  scene loader and activity hook.

## Testing strategy

### Model tests

- market-cap normalization produces bounded monotonic radii;
- market IDs generate deterministic finite positions and velocities;
- missing market data produces safe defaults;
- fixed-step output is deterministic for identical state and input;
- attraction moves bodies toward the correct target;
- collisions separate overlapping bodies and keep values finite;
- chamber bounds contain the full sphere;
- active-market changes do not recreate body identity.

### Component tests

- watchlist, table, readout, and scene model receive the expected image URL;
- successful DOM logos use explicit dimensions and decorative alt text;
- missing/failed logos show the symbol fallback;
- the scene contains one named bubble per market and no blade/lane/trench nodes;
- clicking a bubble selects its market;
- reduced motion configures a demand frame loop and does not mutate physics.

### Browser tests

- the real ConnectRPC market request succeeds through the gateway;
- visible logos load for the returned markets;
- selecting several markets through both watchlist and table keeps the readout
  synchronized and emits no page/R3F errors;
- desktop and `390x844` mobile layouts contain all primary regions without
  document overflow;
- reduced-motion canvas output remains byte-static across the observation
  interval;
- WebGL fallback remains readable when canvas creation is unavailable.

## Acceptance criteria

1. The first viewport contains a zero-gravity field of ten logo-bearing 3D
   bubbles and contains no liquidity blades, lanes, trench, scan plane, or
   floor grid.
2. Bubble radius visibly and monotonically represents market cap while staying
   within the specified range.
3. Positive, negative, and neutral changes have distinct approved halo colors.
4. Bubbles drift, attract, collide, respect bounds, and react to the pointer
   without React state updates in the frame loop.
5. Selecting a market through any existing surface updates the active bubble
   without an R3F runtime error or physics reset.
6. Watchlist and table display real logos when supplied and safe symbol
   fallbacks otherwise.
7. Reduced motion, hidden-document, offscreen, WebGL-failure, and missing-logo
   states retain usable market information.
8. Focused tests, full dapp tests, typecheck, architecture lint, Biome checks,
   production build, and browser QA pass for all touched behavior.
