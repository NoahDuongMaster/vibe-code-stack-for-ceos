# Dapp Crypto Dashboard Design

**Date:** 2026-07-18

**Status:** Approved for implementation

## Problem

`apps/dapp` currently renders the repository's boilerplate marketing page at
`/`. The product needs that route to become a public, read-only crypto market
dashboard backed by the existing `trading.v1.TradingService.GetMarkets` RPC
through `services/api-gateway`.

The dashboard must demonstrate the actual platform architecture rather than
introduce a parallel REST integration. It must use the generated ConnectRPC
contract, preserve the dapp's Feature-Sliced Design boundaries, and deliver a
distinctive WebGL 3D experience without making core market data inaccessible or
GPU-heavy.

## Goals

- Replace the current `/` boilerplate page with a polished crypto dashboard.
- Load real current-market snapshots through API Gateway using ConnectRPC.
- Display ten approved crypto assets quoted in USD.
- Make market data public while retaining gateway rate limiting.
- Use a true WebGL 3D scene as the dashboard's visual centerpiece.
- Preserve a semantic, responsive DOM dashboard independent of the canvas.
- Handle loading, refresh, stale data, malformed data, transport errors, reduced
  motion, and unavailable WebGL explicitly.
- Add behavior-focused tests for gateway policy, data access, models, UI states,
  and the scene's data mapping/fallback.

## Non-goals

- Do not add trading, wallets, portfolios, authentication requirements, price
  alerts, favorites, or order placement.
- Do not add historical candles or fabricate a price chart from current-snapshot
  data.
- Do not add currency selection; the MVP uses USD only.
- Do not add dynamic top-asset discovery; the MVP requests a fixed set of ten
  CoinGecko asset IDs.
- Do not render essential content or the market table inside WebGL.
- Do not deploy from a local machine.

## Product Decisions

The dashboard is public and read-only. It requests these assets in this order:

1. `bitcoin`
2. `ethereum`
3. `tether`
4. `binancecoin`
5. `solana`
6. `ripple`
7. `usd-coin`
8. `dogecoin`
9. `cardano`
10. `avalanche-2`

The quote currency is always `usd`. TanStack Query treats data as fresh for 60
seconds and refetches every 60 seconds while the dashboard is active.

## Approaches Considered

### 1. Direct ConnectRPC dashboard with a WebGL scene — selected

The browser uses the existing `@packages/api-client` `createTradingClient`
factory against `NEXT_PUBLIC_API_ENDPOINT`. The RPC descriptor derives the
wire path and request/response types from Protobuf. A client-only React Three
Fiber scene consumes the same validated page model as the semantic dashboard.

This is the shortest type-safe route from UI to API Gateway and makes the
existing protocol/client packages useful in the dapp.

### 2. Same-origin Next BFF in front of API Gateway — rejected

A Route Handler could proxy the gateway and provide server rendering, but it
would add another transport/cache boundary for public, frequently refreshed
data. It would also obscure that the browser client and gateway already support
ConnectRPC and CORS.

### 3. CSS-only 3D presentation — rejected

CSS perspective and Motion would produce a smaller bundle, but the approved
visual direction is a true interactive WebGL scene rather than a 3D-styled DOM
illustration.

## User Experience

### Visual direction

The route becomes a dark “Vibe Markets” command deck with restrained cyan,
violet, and coral accents. Layered radial light, a spatial grid, glass panels,
and a WebGL scene create depth without reducing text contrast.

The first viewport contains:

- a compact header with the Vibe Markets identity, live/stale status, last
  update time, and a manual refresh control;
- a DOM hero overlay introducing the market pulse;
- a WebGL scene containing ten extruded token meshes orbiting a luminous market
  core;
- four summary cards for selected-market capitalization, 24-hour volume,
  strongest gainer, and overall gain/loss breadth.

Below the hero, a semantic market table shows rank, asset, price, 24-hour
change, market capitalization, and volume. On narrow screens the table becomes
one accessible card per asset rather than forcing horizontal scrolling.

### WebGL scene

The scene uses Three.js through React Three Fiber. It is dynamically imported
with server-side rendering disabled and never owns business data fetching.

Scene mapping is deterministic:

- request order and market-cap rank determine orbit placement;
- logarithmically normalized market cap determines token scale;
- 24-hour percentage sign selects positive/negative/neutral color;
- clamped absolute 24-hour percentage controls emissive intensity and orbital
  energy;
- pointer movement adds bounded parallax;
- pointer hover or keyboard focus on the matching DOM market row selects a
  token and exposes its name, price, and change in a DOM tooltip/status region.

Tokens are lightweight extruded discs with symbol marks rather than remote logo
textures. The scene uses instancing/shared geometry where practical, caps device
pixel ratio, avoids expensive real-time shadows, and pauses animation when the
document is hidden or the scene is offscreen.

The canvas is decorative enhancement. It is hidden from assistive technology;
all values and interactions remain available through the DOM dashboard.

## Architecture

### Runtime data flow

```text
Next route entrypoint
  -> HomePage (Server Component)
    -> MarketDashboard (client boundary)
      -> useMarkets() (TanStack Query)
        -> getMarkets() (same page-slice API)
          -> configured TradingClient
            -> createTradingClient(NEXT_PUBLIC_API_ENDPOINT)
              -> API Gateway
                -> trading.v1.TradingService.GetMarkets
                  -> trading-rpc market-data capability
```

No component calls `fetch`, axios, or raw Connect JSON. The descriptor in
`@packages/protocol` remains the source of the RPC method and types.

### Dapp Feature-Sliced Design

Market logic stays in the existing home Page slice because it is consumed only
by this route:

```text
apps/dapp/src/_pages/home/
  api/
    get-markets.api.ts       typed Connect call and safe transport-error mapping
  model/
    market.constants.ts      approved IDs, USD, query key, refresh interval
    market.schema.ts         Zod semantic response/page-model schemas
    market.mapper.ts         generated RPC messages -> dashboard model
    market-scene.mapper.ts   dashboard model -> bounded WebGL scene values
    use-markets.ts           TanStack Query orchestration
  ui/
    home-page.tsx            server composition only
    market-dashboard.tsx     narrow client boundary and state composition
    market-scene.tsx         WebGL implementation
    market-scene-fallback.tsx
    market-header.tsx
    market-metrics.tsx
    market-table.tsx
    market-state.tsx         loading/error/stale presentation
  index.ts                   Page public API
```

No `entity`, `feature`, or `widget` is introduced until another consumer makes
that reuse real. Imports use the `@/` alias and the slice public API rules from
`AGENTS.md`.

### Configured Connect client

`apps/dapp/src/shared/api` owns the configured `TradingClient` instance so the
Page API consumes a lower-layer public API rather than constructing transports
itself. `apps/dapp` adds `@packages/api-client` as a workspace dependency.
The scene adds `three`, `@react-three/fiber`, and `@react-three/drei`; renderer
types remain contained inside the Page UI/scene-model boundary.

The existing `NEXT_PUBLIC_API_ENDPOINT` becomes the documented API Gateway base
URL and a required validated URL (`http://localhost:8787` in development).
Staging and production continue to receive the environment-specific gateway URL
through their existing CI vars.

`AGENTS.md` HTTP guidance changes to reflect the approved rule:

- RPC API modules use configured typed clients from `@/shared/api`.
- REST/BFF API modules use `xhr`.
- Components call neither transport directly.

### Gateway access and rate-limit policy

The gateway currently supplies one `GatewayAccessPolicy` instance to both auth
and rate limiting, so every public route also bypasses rate limiting. The
composition root will instead create two explicit policies:

- auth-public paths: `/healthz`, `/health.v1.HealthService/Health`, and
  `/trading.v1.TradingService/GetMarkets`;
- rate-limit-exempt paths: `/healthz` and
  `/health.v1.HealthService/Health` only.

`GetMarkets` therefore remains accessible when `JWT_SECRET` is configured but
still consumes the existing Durable Object token bucket. The development CORS
allowlist already includes `http://localhost:3000`; staging and production must
set their real dapp origins through the existing `CORS_ORIGINS` variables.

## Data Model And Formatting

The Page API calls:

```typescript
tradingClient.getMarkets({
  coinIds: MARKET_COIN_IDS,
  vsCurrency: 'usd',
})
```

Generated Protobuf types provide structural typing. Zod then validates semantic
UI invariants: a non-empty response, known asset IDs, finite numeric values,
valid optional image URLs/timestamps, and the expected USD quote currency.
Optional upstream values remain optional and render as an em dash rather than
zero.

Formatting uses `Intl.NumberFormat`:

- USD price precision adapts for sub-dollar assets;
- market capitalization and volume use compact notation;
- percentage change includes an explicit sign and two decimal places;
- timestamps render in the viewer's locale while retaining a machine-readable
  `dateTime` value.

Summary metrics are derived only from the returned ten-asset snapshot. Labels
make that scope explicit and do not claim to represent the entire crypto market.

## State And Error Handling

- Initial loading renders a neutral scene/fallback plus metric and market-row
  skeletons matching the final layout.
- Successful data drives the DOM dashboard and the scene through one immutable
  page model.
- Background refetch keeps current data visible and changes status to
  “Updating”.
- A background-refetch failure retains cached data, marks it stale, reports the
  exception to Sentry, and offers retry.
- An initial transport, Connect, or validation failure reports to Sentry and
  shows a generic message with retry. Raw upstream/internal messages are never
  rendered.
- An empty or semantically invalid response is an error, not an empty-market
  state.
- Missing optional metrics render unavailable markers without failing the whole
  snapshot.

## Performance And Accessibility

- `HomePage` remains a Server Component; the client directive starts at
  `MarketDashboard` and the WebGL scene is dynamically imported with
  `{ ssr: false }`.
- The scene caps DPR, reuses geometry/materials, avoids real-time shadows, and
  suspends work when hidden or offscreen.
- `prefers-reduced-motion` freezes orbital/parallax movement while retaining the
  current scene composition.
- A static styled fallback is used when WebGL initialization fails.
- The table uses semantic headings, row headers, and machine-readable values.
- Positive/negative status uses icons/text in addition to color.
- Controls are keyboard reachable with visible focus styles and descriptive
  labels.
- Remote asset images in the DOM use `next/image` with explicit dimensions and
  meaningful alt text; scene tokens do not depend on those images.
- Text and interactive contrast meet WCAG 2.2 AA.

## Testing

### Gateway

- Authorization tests prove `GetMarkets` is public when JWT auth is enabled.
- Rate-limit tests prove `GetMarkets` still consumes and honors the limiter.
- Existing health tests prove operational paths remain auth- and
  rate-limit-exempt.

### Dapp data and model

- The Page API test asserts the exact ten IDs, USD quote, Connect client call,
  safe Connect error mapping, and semantic validation.
- Schema/mapper tests cover nullable optional fields, non-finite numbers,
  unknown IDs, invalid quote currency, empty responses, formatting, and summary
  derivation.
- Scene-mapper tests prove bounded scale, color class, emissive intensity, and
  orbit values without snapshotting Three.js internals.
- Hook tests cover initial load, success, cached refetch, stale error, retry,
  query key, and 60-second refresh configuration.

### Dapp UI and WebGL

- Testing Library covers loading, success, stale/error messages, retry,
  accessible table/card content, positive/negative labels, and missing values.
- WebGL component tests mock the renderer boundary and verify fallback,
  reduced-motion behavior, and data handoff; shaders and renderer internals are
  not snapshot-tested.
- Playwright smoke tests use deterministic mocked market responses to verify the
  dashboard and the first-load error/retry path.

### Gates

Run the focused dapp and gateway tests, their architecture checks, and then:

```bash
mise run typecheck
mise run check:ci
mise run lint
mise run test
mise run build
```

No local deployment command is run.
