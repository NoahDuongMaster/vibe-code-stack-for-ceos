# Dapp Liquidity Reactor Redesign

**Date:** 2026-07-18

**Status:** Visual direction approved; awaiting written-spec review

## Problem

The crypto dashboard is functionally correct and already loads its market
snapshot through the generated ConnectRPC client, but its presentation does not
match the intended product identity. The current cyan-and-violet glass-card
dashboard, spatial grid, central polyhedron, and orbiting pastel token discs read
as a generic Web3 template. The WebGL scene is present without communicating the
pressure, liquidity, volatility, or density associated with a live crypto market.

The redesign must make the first viewport feel like an opinionated degen trading
instrument while preserving the existing data flow, semantic DOM, accessibility,
performance controls, error behavior, and Feature-Sliced Design boundaries.

## Goals

- Give the public dashboard a distinctive “on-chain war room” identity.
- Make live market data, the selected asset, and market direction understandable
  within the first viewport.
- Replace the planetary WebGL metaphor with a data-driven liquidity reactor.
- Synchronize watchlist focus, pointer selection, and the WebGL selection state.
- Increase information density without compromising legibility or mobile use.
- Preserve the existing ConnectRPC request, TanStack Query lifecycle, Zod
  validation, formatting, error reporting, and refresh behavior.
- Maintain WCAG 2.2 AA semantics and reduced-motion/WebGL fallbacks.

## Non-goals

- Do not add trading, wallets, balances, order entry, leverage, candles, price
  history, or portfolio data.
- Do not invent data that is absent from the current market snapshot.
- Do not change the Protobuf contract, API Gateway, trading service, or dapp
  transport configuration.
- Do not move essential text or table content into the canvas.
- Do not introduce a new frontend layer or slice solely for the redesign.
- Do not hand-edit Panda's generated `src/styled-system` output.

## Approaches Considered

### 1. Liquidity Reactor — selected

An asymmetric terminal surrounds a WebGL “liquidity canyon” made from ten
market blades. Market capitalization controls blade height and footprint,
24-hour change controls direction and gain/loss energy, and volume controls the
strength of the pulse. A moving scan plane and active-asset beam provide the
single memorable visual signature.

This direction combines degen energy with a disciplined data hierarchy. It is
distinctive without relying on meme assets, remote token artwork, or a dense
collection of ornamental effects.

### 2. Meme Casino — rejected

Sticker graphics, jackpot language, extreme gradients, and aggressive motion
would produce a louder first impression, but it would age quickly, weaken trust
in the data, and encourage decoration unrelated to the available snapshot.

### 3. On-chain Bloomberg — rejected

A near-monochrome, typography-first terminal would maximize information density
and credibility, but would underuse the requested WebGL scene and miss the
explicitly degen personality.

## Product And Audience

The subject is a public USD crypto market dashboard for users who already
recognize token symbols and want a fast pulse check rather than an introductory
crypto explainer. The page's single job is to let a user scan ten liquid assets,
identify momentum, and inspect one selected asset without leaving the screen.

The interface voice is terse and operational. Labels describe data or actions;
they do not use faux-trader promises, financial advice, or decorative lore.

## Visual System

### Palette

All redesign colors derive from six named tokens:

| Token | Value | Role |
|---|---:|---|
| Void | `#050507` | page and scene depth |
| Carbon | `#0A0D0B` | elevated terminal surfaces |
| Bone | `#E9F1E2` | primary text and high-value numerals |
| Toxic | `#C7FF2F` | live state, gain energy, focus, active selection |
| Plasma | `#8B5CF6` | neutral topology and secondary depth |
| Rekt | `#FF3B5C` | losses and destructive/stale attention |

Supporting muted text, borders, and glow colors are alpha variants of these
tokens rather than independent accent colors. Positive and negative meaning is
always paired with text, sign, or iconography.

### Typography

- **Display and identity:** Unbounded, used sparingly for the `VIBE//X` mark,
  selected asset symbol, and one headline-level statement.
- **Body and controls:** Manrope, used for readable labels, descriptions, and
  compact interface copy.
- **Market data:** IBM Plex Mono, with tabular numerals for prices, percentages,
  timestamps, ranks, and compact metrics.

Fonts load through `next/font/google`, expose CSS variables in the root layout,
and retain system fallbacks. Only required weights are loaded. The redesign
does not rely on text rendered into WebGL.

### Shape And Surface

The layout avoids a grid of interchangeable rounded cards. Primary surfaces use
square or lightly clipped corners, one-pixel rules, inset separators, and small
technical notches. Rounded pills are reserved for actual compact status or
control semantics. Glass blur is limited to the selected-asset overlay where it
separates text from the moving scene.

Background detail uses a restrained fine-noise effect, sparse coordinate marks,
and a single off-axis Plasma wash. It does not repeat the existing full-page
cyan grid.

## Layout And Hierarchy

Desktop composition at 1440 pixels and above:

```text
┌ VIBE//X ─ BTC / ETH / SOL market tape ─ LIVE · time · refresh ┐
├────────────────────────────────────────────┬──────────────────┤
│                                            │ MARKET WATCH     │
│ LIQUIDITY REACTOR                          │ 01 BTC  $... ... │
│ WebGL market blades and active scan plane  │ 02 ETH  $... ... │
│                                            │ 03 USDT $... ... │
│ BTC                                        │ ...              │
│ $64,045.00  −0.16%                         │ 10 AVAX $... ... │
├────────────────────────────────────────────┴──────────────────┤
│ MARKET CAP / VOLUME / LEADER / BREADTH compact metric rail   │
├───────────────────────────────────────────────────────────────┤
│ MARKET MATRIX — dense semantic table                          │
└───────────────────────────────────────────────────────────────┘
```

- The top bar replaces the oversized generic hero. It holds identity, a compact
  three-asset tape derived from the same snapshot, data status, local update
  time, and the refresh action.
- The first viewport uses a 9/3 asymmetric grid: the reactor is the dominant
  field and the complete ten-asset watchlist is the control rail.
- The active asset appears as an oversized symbol and price inside a DOM overlay
  anchored to the scene. It is the visual headline; explanatory marketing copy
  is removed.
- The four summary values become one compact instrument rail rather than four
  equal promotional cards.
- The full semantic table remains below the fold for deliberate comparison.

At tablet width the watchlist moves below the reactor as a horizontally
scrollable asset strip with visible scroll affordance. On mobile the reactor is
shortened, the selected-asset overlay stays inside its bounds, metrics form a
two-column rail, and assets render as the existing accessible card list. No
critical value requires horizontal page scrolling.

## WebGL Liquidity Reactor

### Data mapping

The reactor uses the existing deterministic scene model and extends it with
bounded presentation values:

- market-cap normalization controls blade height and base width;
- market-cap rank fixes each blade's stable lane and depth;
- the sign of 24-hour change selects Toxic, Rekt, or Plasma energy;
- clamped absolute change controls lean angle and emissive intensity;
- normalized 24-hour volume controls pulse amplitude and scan response;
- the selected market controls the active beam, camera emphasis, and DOM
  overlay; it does not reorder the scene.

Missing optional inputs map to neutral, finite defaults. Scene mapping remains
pure and unit-tested outside Three.js.

### Geometry and composition

Ten beveled rectangular blades form two opposing rows around a central trench.
A thin wireframe depth grid and a small number of particles establish scale.
The selected blade receives a narrow vertical beam and a scan plane passes
through the reactor at a low, consistent frequency. The camera uses a low
three-quarter angle so height, lean, and lane placement remain readable.

The previous icosahedron, orbital rings, cylindrical coin tokens, and orbital
movement are removed. Geometry and materials are reused; the scene does not
load remote textures, cast real-time shadows, or require post-processing.

### Interaction and motion

- Hovering, focusing, or selecting a DOM watchlist item updates the active
  market and reactor emphasis.
- Selecting a WebGL blade updates the same active market state.
- Pointer movement creates only a bounded camera drift; it does not move data
  geometry unpredictably.
- Initial load has one orchestrated reveal: blades rise in rank order while the
  scan plane becomes visible. Ambient motion then settles into a slow pulse.
- `prefers-reduced-motion`, a hidden document, or an offscreen scene disables
  continuous movement and leaves a fully composed static frame.

### Fallback

The non-WebGL fallback mirrors the reactor silhouette with CSS gradients and
ten deterministic blades. It uses the same Void/Toxic/Plasma/Rekt language and
does not fall back to the current planetary illustration. Essential selection
and values remain in the DOM regardless of renderer availability.

## Component And FSD Design

The redesign stays in the home Page slice:

```text
apps/dapp/src/_pages/home/
  model/
    market-scene.mapper.ts       bounded reactor presentation values
    market.schema.ts             existing validated market model
  ui/
    market-dashboard.tsx         state and responsive composition
    market-header.tsx            identity, tape, status, refresh
    market-watchlist.tsx         first-viewport selection control
    market-metrics.tsx           compact metric rail
    market-scene.tsx             WebGL reactor implementation
    market-scene-fallback.tsx    static reactor fallback
    market-scene-shell.ts        shared canvas/fallback shell style
    market-table.tsx             detailed desktop/mobile comparison
    market-state.tsx             loading, stale, and error presentation
```

`market-watchlist.tsx` is a Page UI module, not a new Widget, because it has no
independent consumer. All imports remain absolute and inside the existing Page
slice. `home-page.tsx` remains a Server Component, `market-dashboard.tsx`
remains the narrow data/state client boundary, and the heavy WebGL module stays
dynamically imported with server-side rendering disabled.

Styling remains authored through Panda CSS calls and the Panda config. Generated
styled-system files are regenerated through the existing workspace commands and
never edited directly.

## Data Flow

The redesign does not alter transport or validation:

```text
MarketDashboard
  -> useMarkets()
    -> getMarkets()
      -> configured ConnectRPC TradingClient
        -> API Gateway
          -> trading.v1.TradingService.GetMarkets

validated snapshot
  -> header tape
  -> active-market overlay
  -> watchlist
  -> metric rail
  -> market table
  -> pure scene mapper -> WebGL reactor
```

One `activeMarketId` remains the shared interaction state. An invalid or missing
selection falls back to the first returned market. The scene never performs its
own network request and components never call `fetch`, axios, or a transport
client directly.

## Loading, Error, And Stale States

- Initial loading renders the terminal frame immediately, neutral reactor
  blades, stable metric placeholders, and watchlist skeleton rows. Layout does
  not jump when data arrives.
- Successful data replaces placeholders in one visual reveal without delaying
  access to semantic values.
- Background refresh retains current values, changes the live indicator to
  updating, and does not restart the full scene entrance.
- Stale cached data remains visible with a compact Rekt-bordered status notice
  and retry action.
- Initial failure retains the terminal shell, shows the existing generic safe
  message and retry control, reports through Sentry, and never renders upstream
  error text.
- Missing optional metrics render em dashes and neutral reactor energy.

## Accessibility And Performance

- Canvas remains `aria-hidden`; the active value is announced through a
  dedicated polite DOM status region.
- Watchlist items and table asset controls are native buttons with visible Toxic
  focus treatment and descriptive accessible names.
- Status, gains, and losses use labels/signs/icons in addition to color.
- Text/background combinations meet WCAG 2.2 AA; the Toxic accent is not used
  as small text on Bone.
- The heavy scene remains code-split with `next/dynamic` and `{ ssr: false }`.
- Canvas DPR remains capped, geometry/materials are shared, and there are no
  real-time shadows or mandatory post-processing passes.
- Resize work uses the renderer/container lifecycle without unthrottled global
  listeners. Continuous animation stops when hidden, offscreen, or reduced
  motion is requested.
- Mobile receives the same data and interactions with a simpler composition;
  WebGL enhancement never blocks the market list.

## Testing And Acceptance Criteria

Implementation follows test-first red/green/refactor cycles for behavior changes.

### Model tests

- Scene mapping produces finite, bounded blade height, width, lean, pulse,
  lane, color, and energy values.
- Missing market cap, volume, or change produces deterministic neutral values.
- Request order produces stable lanes across selection changes.

### UI tests

- Successful state exposes the `VIBE//X` identity, all ten watchlist assets,
  active asset price/change, compact metrics, and detailed market matrix.
- Keyboard focus on a watchlist or table asset changes the shared scene
  selection and accessible active-market announcement.
- Refresh, updating, stale, loading, missing-value, first-load error, and retry
  behaviors remain covered.
- Mobile composition preserves every market value and control without relying
  on the desktop table.

### WebGL boundary tests

- Canvas keeps capped DPR, static fallback, and the correct active-market data.
- Reduced motion uses a demand-driven frame loop and does not mutate animated
  scene transforms.
- Pointer selection of a blade updates the shared active market.
- Renderer internals and exact pixels are not snapshot-tested.

### Browser acceptance

- At 1600×1000 the reactor and complete watchlist are visible in the first
  viewport, and the page no longer presents the former planetary scene or four
  equal promotional cards.
- At a representative mobile viewport the selected asset, reactor, watchlist,
  metrics, and market cards are usable without horizontal page overflow.
- A real, unmocked browser request reaches the configured API Gateway through
  ConnectRPC and renders returned markets.
- Browser console has no uncaught errors; WebGL fallback and reduced-motion mode
  remain usable.

### Repository gates

Before completion, run focused dapp tests and architecture checks, then:

```bash
mise run typecheck
mise run check:ci
mise run lint
mise run test
mise run build
```

No local deployment command is run.

