# Notion SRS Visual Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, validate, upload, and place 28 deterministic SVG diagrams across the Benadep Affiliate SRS, then synchronize the master and 26 child pages to version 0.5 without changing the functional baseline.

**Architecture:** A small Node 22 TypeScript toolchain owns a typed diagram manifest, semantic diagram specs, a dependency-free SVG renderer, and safety/coverage validation. Generated assets live under `docs/superpowers/assets/notion-srs-visuals/`; the Notion update phase uploads and immediately attaches each SVG using manifest anchors, then performs a read-back audit before changing document versions.

**Tech Stack:** Node.js 22 native erasable TypeScript, Node test runner, SVG 1.1, Notion MCP attachment/fetch/update tools, existing Notion SRS v0.4/v0.2 content

## Global Constraints

- Create exactly 28 new SVG files at viewBox `0 0 1600 900`; retain the existing master infographic.
- Do not use image-generation models, Shopee logos, Shopee trade dress, external fonts, external images, JavaScript, or remote resources inside SVG.
- Text contrast is at least 4.5:1; graphical boundaries are at least 3:1; primary labels are at least 18 px.
- Actor colors are fixed: creator blue, seller orange, MCN purple, admin/risk/finance red, money green, platform/external gray.
- Solid edges mean request/command/navigation; dashed edges mean async event/webhook; dotted edges mean audit/evidence/traceability.
- Every coded node must remain inside its target page's `CN`, `MH`, or `KT` range.
- Visuals explain the normative text; they never add requirements or claim Shopee's secret ranking, attribution arbitration, or anti-fraud algorithm.
- Preserve money states exactly: `estimated`, `approved`, `payable`, `paid`, `held`, `reversed`.
- Responsive web does not satisfy the native-app parity gate for Video/LIVE.
- Upload one SVG and attach it immediately; unattached Notion uploads must not be left to expire.
- Use targeted `update_content` replacements only; never replace an entire Notion page.
- Version baseline is mixed: master/Page 3 are 0.4; Page 1/Page 2/Page 4 are 0.2. All become 0.5 only after all 28 placements pass read-back verification.
- Never deploy from the local machine.

---

### Task 1: Lock the 28-diagram inventory and Notion placement contract

**Files:**
- Create: `scripts/notion-srs-visuals/types.ts`
- Create: `scripts/notion-srs-visuals/manifest.ts`
- Create: `scripts/notion-srs-visuals/manifest.test.ts`

**Interfaces:**
- Consumes: Approved visual design and current Notion page IDs/headings.
- Produces: `TDiagramTarget`, `DIAGRAM_TARGETS`, `TARGET_BY_KEY`, and exact placement/version metadata used by generation and Notion updates.

- [ ] **Step 1: Write the failing manifest test**

Create `scripts/notion-srs-visuals/manifest.test.ts`:

```typescript
import assert from 'node:assert/strict'
import test from 'node:test'

import { DIAGRAM_TARGETS } from './manifest.ts'

test('should define the approved 28 unique SVG targets', () => {
  assert.equal(DIAGRAM_TARGETS.length, 28)
  assert.equal(new Set(DIAGRAM_TARGETS.map((item) => item.key)).size, 28)
  assert.equal(new Set(DIAGRAM_TARGETS.map((item) => item.filename)).size, 28)
  assert.ok(DIAGRAM_TARGETS.every((item) => item.filename.endsWith('.svg')))
})

test('should place two overview, twelve backend, twelve UI, and two test diagrams', () => {
  const count = (kind: string): number =>
    DIAGRAM_TARGETS.filter((item) => item.kind === kind).length

  assert.equal(count('overview'), 2)
  assert.equal(count('backend'), 12)
  assert.equal(count('ui'), 12)
  assert.equal(count('test'), 2)
})

test('should preserve the observed page-level version baseline', () => {
  assert.equal(DIAGRAM_TARGETS.filter((item) => item.previousVersion === '0.2').length, 16)
  assert.equal(DIAGRAM_TARGETS.filter((item) => item.previousVersion === '0.4').length, 12)
  assert.ok(DIAGRAM_TARGETS.every((item) => item.nextVersion === '0.5'))
})

test('should use exact headings as non-destructive insertion anchors', () => {
  assert.ok(DIAGRAM_TARGETS.every((item) => item.insertBefore.startsWith('##')))
  assert.ok(DIAGRAM_TARGETS.every((item) => item.alt.length >= 40))
  assert.ok(DIAGRAM_TARGETS.every((item) => item.caption.includes('normative text')))
})
```

The expected `0.2` count is 16 diagram placements, not 14 pages: Page 1 and Page 4 each receive two diagrams, and the 12 Page 2 pages receive one each.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/notion-srs-visuals/manifest.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `manifest.ts`.

- [ ] **Step 3: Define the shared types**

Create `scripts/notion-srs-visuals/types.ts`:

```typescript
export type TDiagramKind = 'overview' | 'backend' | 'ui' | 'test'
export type TVersion = '0.2' | '0.4' | '0.5'
export type TTone = 'creator' | 'seller' | 'mcn' | 'ops' | 'money' | 'system'
export type TBadge = 'Existing' | 'Extend' | 'New' | 'Field-validation gate'
export type TEdgeStyle = 'solid' | 'dashed' | 'dotted'

export type TDiagramTarget = Readonly<{
  key: string
  filename: string
  kind: TDiagramKind
  pageId: string
  pageLabel: string
  title: string
  codeRange: string
  previousVersion: Exclude<TVersion, '0.5'>
  nextVersion: '0.5'
  insertBefore: string
  alt: string
  caption: string
  relatedPageUrl?: string
}>

export type TDiagramNode = Readonly<{
  id: string
  label: string
  detail: string
  tone: TTone
  badge?: TBadge
}>

export type TDiagramColumn = Readonly<{
  title: string
  nodes: readonly TDiagramNode[]
}>

export type TDiagramEdge = Readonly<{
  from: string
  to: string
  label: string
  style: TEdgeStyle
}>

export type TDiagramSpec = Readonly<{
  key: string
  title: string
  subtitle: string
  scope: string
  columns: readonly TDiagramColumn[]
  edges: readonly TDiagramEdge[]
}>
```

- [ ] **Step 4: Create the complete target manifest**

Create `scripts/notion-srs-visuals/manifest.ts`. Use this helper and exact target rows:

```typescript
import type { TDiagramTarget } from './types.ts'

const visualCaption = (scope: string): string =>
  `${scope}. Solid=request/navigation; dashed=async; dotted=audit/evidence. Visual aid only; normative text remains authoritative.`

const target = (
  value: Omit<TDiagramTarget, 'nextVersion' | 'caption'>,
): TDiagramTarget => ({
  ...value,
  nextVersion: '0.5',
  caption: visualCaption(value.codeRange),
})

export const DIAGRAM_TARGETS = [
  target({ key: 'page-1-system-context', filename: 'srs-page-1-system-context.svg', kind: 'overview', pageId: '9dcad27c837882d9963701525cd9e39a', pageLabel: 'Page 1', title: 'System context & actor map', codeRange: 'SRS-BENA-AFF-US-001 actors and trust boundaries', previousVersion: '0.2', insertBefore: '## Trong phạm vi', alt: 'System context showing Creator, Seller, MCN, Buyer, Operations, Benadep surfaces and external trust boundaries.' }),
  target({ key: 'page-1-end-to-end', filename: 'srs-page-1-end-to-end-flow.svg', kind: 'overview', pageId: '9dcad27c837882d9963701525cd9e39a', pageLabel: 'Page 1', title: 'End-to-end data, money & evidence flow', codeRange: 'SP-001–SP-084 overview', previousVersion: '0.2', insertBefore: '## Luồng sử dụng tổng quát', alt: 'End-to-end flow from affiliate asset and click through attribution, order-line commission, ledger, reconciliation and payout.' }),
  target({ key: '2-01-backend', filename: 'srs-2-01-backend-lifecycle.svg', kind: 'backend', pageId: 'a0fad27c837882bd8a5781a0ce5ef4a6', pageLabel: '2.01', title: 'Identity, onboarding & account lifecycle', codeRange: 'CN-001–CN-009', previousVersion: '0.2', insertBefore: '## Luồng end-to-end', alt: 'Backend lifecycle for affiliate application, identity, channel verification, review, activation, suspension and reverification.', relatedPageUrl: 'https://app.notion.com/p/502ad27c8378822baeff81acdf027872' }),
  target({ key: '2-02-backend', filename: 'srs-2-02-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c83788175ad48e3637264a0c6', pageLabel: '2.02', title: 'Dashboard, offers, commission discovery & referral', codeRange: 'CN-010–CN-019', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend lifecycle for offer discovery, eligibility, enrollment, asset creation, referral and performance aggregation.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c8378818d87b6c9e72728a9d2' }),
  target({ key: '2-03-backend', filename: 'srs-2-03-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c8378815a9ebee9c2cfca01c7', pageLabel: '2.03', title: 'Link, product code, collection & reporting', codeRange: 'CN-020–CN-027', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend flow for tracked link, product code, collection publication, click evidence, conversion report and earning statement.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c8378817fada9f89511ba99e1' }),
  target({ key: '2-04-backend', filename: 'srs-2-04-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c837881859fcad6114eed59a0', pageLabel: '2.04', title: 'Attribution, rate snapshot & commission ledger', codeRange: 'CN-028–CN-039', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend attribution flow from candidates and winner through immutable rate snapshot, order-line journal and adjustment.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881699337d970fd99a9c4' }),
  target({ key: '2-05-backend', filename: 'srs-2-05-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c837881c1b06ddf6cee307cb4', pageLabel: '2.05', title: 'Short Video Commerce lifecycle', codeRange: 'CN-040–CN-047', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend lifecycle for video upload, product tagging, publish, discovery, commerce evidence, moderation and appeal.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c83788162bc0bebeb19eb3654' }),
  target({ key: '2-06-backend', filename: 'srs-2-06-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c837881e09720ee71d2a4239a', pageLabel: '2.06', title: 'LIVE Commerce lifecycle', codeRange: 'CN-048–CN-052', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend lifecycle for LIVE schedule, preflight, ingest, active session, product pin, viewer commerce, replay and moderation.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c83788147a823e5f65aae74c8' }),
  target({ key: '2-07-backend', filename: 'srs-2-07-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c837881568f2ed253143d14b1', pageLabel: '2.07', title: 'Seller PPS, rates & creator contact', codeRange: 'CN-053–CN-056', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend lifecycle for seller PPS enrollment, commission rate versions, creator discovery and consent-scoped contact.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c83788149a696d53cfc062b11' }),
  target({ key: '2-08-backend', filename: 'srs-2-08-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c8378817b8d1ac107731cc836', pageLabel: '2.08', title: 'PPP, collaboration, sample & seller affiliate', codeRange: 'CN-057–CN-065', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend lifecycle for proposal, contract version, funded fee, sample shipment, deliverable review and release.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c8378819e8100d2b502000d4e' }),
  target({ key: '2-09-backend', filename: 'srs-2-09-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c83788133902fe4ce1910435e', pageLabel: '2.09', title: 'MCN roster, RBAC & revenue split', codeRange: 'CN-066–CN-072', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend lifecycle for MCN application, membership, roles, campaign assignment, revenue split and settlement.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881549d4af92e27878a6c' }),
  target({ key: '2-10-backend', filename: 'srs-2-10-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c8378814d9d0fe3849c42f3fc', pageLabel: '2.10', title: 'Reconciliation, payout, tax & remediation', codeRange: 'CN-073–CN-077', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend flow for tax and payment verification, wallet, statements, reconciliation, holds, retries and corrections.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c83788173ae60c1f3ddda9fe0' }),
  target({ key: '2-11-backend', filename: 'srs-2-11-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c837881348366cc8572374d38', pageLabel: '2.11', title: 'Fraud, enforcement & appeals', codeRange: 'CN-078–CN-082', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend lifecycle for fraud report, case triage, evidence graph, decision, enforcement, appeal and recall.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881998be8c368ba4437b9' }),
  target({ key: '2-12-backend', filename: 'srs-2-12-backend-lifecycle.svg', kind: 'backend', pageId: '3a0ad27c837881b4beb5e186e857672b', pageLabel: '2.12', title: 'External distribution & YouTube Shopping', codeRange: 'CN-083–CN-084', previousVersion: '0.2', insertBefore: '## Luồng xử lý end-to-end', alt: 'Backend flow for external property verification, OAuth, catalog feed sync, product tagging and channel reporting.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881b1b359f8df360d1bef' }),
  target({ key: '3-01-ui', filename: 'srs-3-01-ui-navigation.svg', kind: 'ui', pageId: '502ad27c8378822baeff81acdf027872', pageLabel: '3.01', title: 'Identity and onboarding UI navigation', codeRange: 'MH-001–MH-005', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across affiliate center, application, channel verification, settings and admin review screens.', relatedPageUrl: 'https://app.notion.com/p/a0fad27c837882bd8a5781a0ce5ef4a6' }),
  target({ key: '3-02-ui', filename: 'srs-3-02-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c8378818d87b6c9e72728a9d2', pageLabel: '3.02', title: 'Dashboard, offer and referral UI navigation', codeRange: 'MH-006–MH-011', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across affiliate dashboard, product marketplace, offer detail, invitations, referral and offer management.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c83788175ad48e3637264a0c6' }),
  target({ key: '3-03-ui', filename: 'srs-3-03-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c8378817fada9f89511ba99e1', pageLabel: '3.03', title: 'Link, collection and reporting UI navigation', codeRange: 'MH-012–MH-017', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across link builder, code generator, collection manager, public collection and financial reports.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c8378815a9ebee9c2cfca01c7' }),
  target({ key: '3-04-ui', filename: 'srs-3-04-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c837881699337d970fd99a9c4', pageLabel: '3.04', title: 'Attribution and ledger UI navigation', codeRange: 'MH-018–MH-021', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across conversion attribution detail, seller rate simulator, creator ledger and attribution explorer.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881859fcad6114eed59a0' }),
  target({ key: '3-05-ui', filename: 'srs-3-05-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c83788162bc0bebeb19eb3654', pageLabel: '3.05', title: 'Short Video Commerce UI navigation', codeRange: 'MH-022–MH-026', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'Mobile-first UI navigation across video feed, composer, product picker, detail sheet, moderation and appeal.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881c1b06ddf6cee307cb4' }),
  target({ key: '3-06-ui', filename: 'srs-3-06-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c83788147a823e5f65aae74c8', pageLabel: '3.06', title: 'LIVE Commerce UI navigation', codeRange: 'MH-027–MH-031', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'Mobile-first UI navigation across LIVE discovery, setup, host console, viewer room, replay and moderation.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881e09720ee71d2a4239a' }),
  target({ key: '3-07-ui', filename: 'srs-3-07-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c83788149a696d53cfc062b11', pageLabel: '3.07', title: 'Seller PPS and creator contact UI navigation', codeRange: 'MH-032–MH-035', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across PPS enrollment, commission rate configuration, creator directory and contact consent.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881568f2ed253143d14b1' }),
  target({ key: '3-08-ui', filename: 'srs-3-08-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c8378819e8100d2b502000d4e', pageLabel: '3.08', title: 'PPP collaboration UI navigation', codeRange: 'MH-036–MH-040', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across collaboration inbox, contract editor, sample tracker, deliverable review and seller affiliate dashboard.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c8378817b8d1ac107731cc836' }),
  target({ key: '3-09-ui', filename: 'srs-3-09-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c837881549d4af92e27878a6c', pageLabel: '3.09', title: 'MCN and agency UI navigation', codeRange: 'MH-041–MH-045', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across MCN application, roster invitations, sub-account RBAC, campaign assignments and settlement reports.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c83788133902fe4ce1910435e' }),
  target({ key: '3-10-ui', filename: 'srs-3-10-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c83788173ae60c1f3ddda9fe0', pageLabel: '3.10', title: 'Payout, tax and reconciliation UI navigation', codeRange: 'MH-046–MH-050', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across creator wallet, tax and payment setup, statements, payout remediation and finance reconciliation.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c8378814d9d0fe3849c42f3fc' }),
  target({ key: '3-11-ui', filename: 'srs-3-11-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c837881998be8c368ba4437b9', pageLabel: '3.11', title: 'Fraud, enforcement and appeal UI navigation', codeRange: 'MH-051–MH-055', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across fraud report, risk queue, case graph, enforcement appeal and policy recall console.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881348366cc8572374d38' }),
  target({ key: '3-12-ui', filename: 'srs-3-12-ui-navigation.svg', kind: 'ui', pageId: '3a0ad27c837881b1b359f8df360d1bef', pageLabel: '3.12', title: 'External distribution UI navigation', codeRange: 'MH-056–MH-059', previousVersion: '0.4', insertBefore: '### Quy ước Component Contract', alt: 'UI navigation across property registry, YouTube OAuth connection, external product feed health and channel reports.', relatedPageUrl: 'https://app.notion.com/p/3a0ad27c837881b4beb5e186e857672b' }),
  target({ key: 'page-4-traceability', filename: 'srs-page-4-traceability.svg', kind: 'test', pageId: 'cd0ad27c83788331af0301132464b33b', pageLabel: 'Page 4', title: 'Requirement traceability chain', codeRange: 'SP → CN → QT → MH/non-UI → KT → evidence', previousVersion: '0.2', insertBefore: '## A. Kịch bản theo capability', alt: 'Traceability chain from observable Shopee outcome through SRS requirements and test cases to evidence and validation gates.' }),
  target({ key: 'page-4-release-gate', filename: 'srs-page-4-release-evidence-gate.svg', kind: 'test', pageId: 'cd0ad27c83788331af0301132464b33b', pageLabel: 'Page 4', title: 'Test and evidence release gate', codeRange: 'KT-001–KT-120 and release evidence', previousVersion: '0.2', insertBefore: '## Điều kiện hoàn thành', alt: 'Release gate combining capability, golden, algorithm, security, accessibility, finance and source-code evidence.' }),
] as const satisfies readonly TDiagramTarget[]

export const TARGET_BY_KEY = new Map(
  DIAGRAM_TARGETS.map((item) => [item.key, item] as const),
)
```

- [ ] **Step 5: Run the manifest test and verify GREEN**

Run: `node --test scripts/notion-srs-visuals/manifest.test.ts`

Expected: 4 tests PASS.

- [ ] **Step 6: Commit the inventory contract**

```bash
git add scripts/notion-srs-visuals/types.ts scripts/notion-srs-visuals/manifest.ts scripts/notion-srs-visuals/manifest.test.ts
git commit -m "test(docs): lock Notion SRS visual inventory"
```

### Task 2: Build and test the dependency-free SVG renderer

**Files:**
- Create: `scripts/notion-srs-visuals/svg-renderer.ts`
- Create: `scripts/notion-srs-visuals/svg-renderer.test.ts`

**Interfaces:**
- Consumes: `TDiagramSpec` from Task 1.
- Produces: `renderDiagram(spec: TDiagramSpec): string`, a safe `1600 × 900` SVG with title, description, columns, nodes, routed edges, badges, and legend.

- [ ] **Step 1: Write renderer behavior tests**

Create a fixture with two columns, creator/system nodes, and all three edge styles. Assert exact presence of `xmlns="http://www.w3.org/2000/svg"`, `viewBox="0 0 1600 900"`, `<title>`, `<desc>`, `marker-end`, `stroke-dasharray="12 8"`, `stroke-dasharray="3 8"`, and escaped XML text. Assert absence of `<script`, `javascript:`, `<image`, external `href`, and any `http/https` value other than the required SVG namespace.

- [ ] **Step 2: Run the renderer test and verify RED**

Run: `node --test scripts/notion-srs-visuals/svg-renderer.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `svg-renderer.ts`.

- [ ] **Step 3: Implement the renderer**

Implement these exact exports in `svg-renderer.ts`:

```typescript
import type { TDiagramSpec, TEdgeStyle, TTone } from './types.ts'

const COLORS: Record<TTone, { fill: string; stroke: string; text: string }> = {
  creator: { fill: '#EAF2FF', stroke: '#2457A7', text: '#173A70' },
  seller: { fill: '#FFF0E5', stroke: '#B94F00', text: '#743200' },
  mcn: { fill: '#F3EAFF', stroke: '#7042A1', text: '#472768' },
  ops: { fill: '#FFECEC', stroke: '#B42318', text: '#7A1A14' },
  money: { fill: '#EAF8EF', stroke: '#287A45', text: '#18512D' },
  system: { fill: '#F1F3F5', stroke: '#4B5563', text: '#26303B' },
}

const DASH: Record<TEdgeStyle, string | undefined> = {
  solid: undefined,
  dashed: '12 8',
  dotted: '3 8',
}

export const escapeXml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')

const wrap = (value: string, width = 28): string[] => {
  const words = value.split(/\s+/)
  const lines: string[] = []
  for (const word of words) {
    const last = lines.at(-1)
    if (!last || `${last} ${word}`.length > width) lines.push(word)
    else lines[lines.length - 1] = `${last} ${word}`
  }
  if (lines.length <= 2) return lines
  return [lines[0], `${lines.slice(1).join(' ').slice(0, width - 1)}…`]
}

export const renderDiagram = (spec: TDiagramSpec): string => {
  if (spec.columns.length < 2 || spec.columns.length > 5) {
    throw new Error(`${spec.key}: expected 2–5 columns`)
  }

  const allNodes = spec.columns.flatMap((column) => column.nodes)
  const nodeIds = new Set<string>()
  for (const column of spec.columns) {
    if (column.nodes.length === 0 || column.nodes.length > 4) {
      throw new Error(`${spec.key}: every column needs 1–4 nodes`)
    }
    for (const node of column.nodes) {
      if (nodeIds.has(node.id)) throw new Error(`${spec.key}: duplicate node ${node.id}`)
      nodeIds.add(node.id)
    }
  }
  for (const edge of spec.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`${spec.key}: unknown edge ${edge.from} → ${edge.to}`)
    }
  }

  const left = 60
  const right = 1540
  const gap = 24
  const columnWidth = (right - left - gap * (spec.columns.length - 1)) / spec.columns.length
  const nodeHeight = 112
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>()

  spec.columns.forEach((column, columnIndex) => {
    const x = left + columnIndex * (columnWidth + gap)
    const available = 520 - column.nodes.length * nodeHeight
    const nodeGap = column.nodes.length === 1 ? 0 : available / (column.nodes.length - 1)
    const startY = column.nodes.length === 1 ? 390 : 190
    column.nodes.forEach((node, nodeIndex) => {
      positions.set(node.id, {
        x,
        y: startY + nodeIndex * (nodeHeight + nodeGap),
        width: columnWidth,
        height: nodeHeight,
      })
    })
  })

  const edgeSvg = spec.edges.map((edge) => {
    const from = positions.get(edge.from)!
    const to = positions.get(edge.to)!
    const x1 = from.x + from.width
    const y1 = from.y + from.height / 2
    const x2 = to.x
    const y2 = to.y + to.height / 2
    const bend = Math.max(28, Math.abs(x2 - x1) / 2)
    const dash = DASH[edge.style]
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ''
    const labelX = (x1 + x2) / 2
    const labelY = (y1 + y2) / 2 - 8
    return `<g><path d="M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}" fill="none" stroke="#56616F" stroke-width="3"${dashAttr} marker-end="url(#arrow)"/><text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="16" fill="#26303B">${escapeXml(edge.label)}</text></g>`
  }).join('\n')

  const columnSvg = spec.columns.map((column, columnIndex) => {
    const x = left + columnIndex * (columnWidth + gap)
    const heading = `<text x="${x + columnWidth / 2}" y="164" text-anchor="middle" font-size="19" font-weight="700" fill="#26303B">${escapeXml(column.title)}</text>`
    const nodes = column.nodes.map((node) => {
      const position = positions.get(node.id)!
      const color = COLORS[node.tone]
      const detailLines = wrap(node.detail)
      const detail = detailLines.map((line, index) => `<tspan x="${position.x + 18}" dy="${index === 0 ? 0 : 23}">${escapeXml(line)}</tspan>`).join('')
      const badge = node.badge
        ? `<text x="${position.x + position.width - 14}" y="${position.y + 22}" text-anchor="end" font-size="14" font-weight="700" fill="${color.text}">${escapeXml(node.badge)}</text>`
        : ''
      return `<g><rect x="${position.x}" y="${position.y}" width="${position.width}" height="${position.height}" rx="16" fill="${color.fill}" stroke="${color.stroke}" stroke-width="3"/><text x="${position.x + 18}" y="${position.y + 35}" font-size="22" font-weight="700" fill="${color.text}">${escapeXml(node.label)}</text><text x="${position.x + 18}" y="${position.y + 68}" font-size="18" fill="${color.text}">${detail}</text>${badge}</g>`
    }).join('\n')
    return `${heading}\n${nodes}`
  }).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-labelledby="diagram-title diagram-desc"><title id="diagram-title">${escapeXml(spec.title)}</title><desc id="diagram-desc">${escapeXml(`${spec.subtitle}. ${spec.scope}`)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#56616F"/></marker></defs><rect width="1600" height="900" fill="#FFFFFF"/><text x="60" y="58" font-size="34" font-weight="800" fill="#17202A">${escapeXml(spec.title)}</text><text x="60" y="94" font-size="21" fill="#374151">${escapeXml(spec.subtitle)}</text><text x="60" y="124" font-size="18" fill="#56616F">${escapeXml(spec.scope)}</text>${edgeSvg}${columnSvg}<g transform="translate(60 820)" font-size="16" fill="#26303B"><path d="M 0 12 H 90" stroke="#56616F" stroke-width="3" marker-end="url(#arrow)"/><text x="105" y="18">request / navigation</text><path d="M 345 12 H 435" stroke="#56616F" stroke-width="3" stroke-dasharray="12 8" marker-end="url(#arrow)"/><text x="450" y="18">async / webhook</text><path d="M 680 12 H 770" stroke="#56616F" stroke-width="3" stroke-dasharray="3 8" marker-end="url(#arrow)"/><text x="785" y="18">audit / evidence</text><text x="1120" y="18" font-weight="700">Visual aid — normative SRS text is authoritative</text></g></svg>`
}
```

The implementation must remain dependency-free and must throw descriptive errors for duplicate node IDs, unknown edge endpoints, zero columns, more than five columns, or more than four nodes in one column.

- [ ] **Step 4: Run the renderer tests and verify GREEN**

Run: `node --test scripts/notion-srs-visuals/svg-renderer.test.ts`

Expected: renderer tests PASS.

- [ ] **Step 5: Commit the renderer**

```bash
git add scripts/notion-srs-visuals/svg-renderer.ts scripts/notion-srs-visuals/svg-renderer.test.ts
git commit -m "feat(docs): add safe SRS SVG renderer"
```

### Task 3: Define the four overview and test diagrams

**Files:**
- Create: `scripts/notion-srs-visuals/overview-and-test-specs.ts`
- Create: `scripts/notion-srs-visuals/specs.test.ts`

**Interfaces:**
- Consumes: `TDiagramSpec` and manifest keys.
- Produces: `OVERVIEW_AND_TEST_SPECS`, four specs keyed by `page-1-system-context`, `page-1-end-to-end`, `page-4-traceability`, and `page-4-release-gate`.

- [ ] **Step 1: Write spec coverage tests**

Assert four unique keys, all edge endpoints exist, no node contains any placeholder sentinel from `['T' + 'BD', 'TO' + 'DO', 'Lo' + 'rem']`, Page 4 contains `SP`, `CN`, `QT`, `MH`, `KT`, `evidence`, and the end-to-end flow contains all six money states.

- [ ] **Step 2: Run the focused spec test and verify RED**

Run: `node --test scripts/notion-srs-visuals/specs.test.ts`

Expected: FAIL because the four specs do not exist.

- [ ] **Step 3: Define the exact semantic columns**

Create the four specs with these columns in order:

| Key | Columns/nodes |
|---|---|
| `page-1-system-context` | Actors: Creator, Seller, MCN, Buyer, Ops; Surfaces: Storefront, Vendor Portal, Medusa Admin, External Channel; Benadep domains: Affiliate Identity, Assets/Content, Attribution, Ledger/Payout; Boundaries: Tax/Payment Provider, YouTube/OAuth, Notification; Evidence: Versioned policy, Audit log, Appeal/Support |
| `page-1-end-to-end` | Create: Affiliate asset/content; Observe: Click/touchpoint; Decide: Candidate set + attribution winner; Earn: Order-line rate snapshot → estimated/approved/payable; Settle: Ledger/reconciliation → paid; Control: held/reversed → dispute/appeal + evidence |
| `page-4-traceability` | Observation: Shopee observable outcome; Baseline: SP; Product: CN; Rules: QT; Surface: MH/non-UI; Test: KT; Proof: automated/manual evidence; Gate: field validation for secret/unobservable internals |
| `page-4-release-gate` | Suites: Capability, Golden E2E, Algorithm validation; Cross-cutting: Security, WCAG, Finance reconciliation; Source evidence: code/test/build and authenticated evidence; Approval: Product/Engineering/Legal/Finance/QA; Decision: release only when all required gates pass |

Use dotted edges from every decision/financial node to evidence, dashed edges for provider/async processing, and solid edges for primary flow.

- [ ] **Step 4: Run the spec tests and verify GREEN**

Run: `node --test scripts/notion-srs-visuals/specs.test.ts`

Expected: overview/test spec tests PASS.

- [ ] **Step 5: Commit the overview and test specs**

```bash
git add scripts/notion-srs-visuals/overview-and-test-specs.ts scripts/notion-srs-visuals/specs.test.ts
git commit -m "feat(docs): define SRS overview and test diagrams"
```

### Task 4: Define all twelve backend lifecycle diagrams

**Files:**
- Create: `scripts/notion-srs-visuals/backend-specs.ts`
- Modify: `scripts/notion-srs-visuals/specs.test.ts`

**Interfaces:**
- Consumes: backend manifest keys and `TDiagramSpec`.
- Produces: `BACKEND_SPECS`, exactly twelve specs with keys `2-01-backend` through `2-12-backend`.

- [ ] **Step 1: Extend tests for backend scope**

Assert twelve keys; every subtitle includes the exact `CN` range from the manifest; each spec has 3–5 columns, at least one dotted evidence edge, at least one safe failure/remediation node, and only permitted codes for its range.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test scripts/notion-srs-visuals/specs.test.ts`

Expected: FAIL because `BACKEND_SPECS` is missing.

- [ ] **Step 3: Define the twelve lifecycle specs**

Use these exact primary nodes and flow order; add evidence/version nodes as the final column:

| Key | Primary lifecycle |
|---|---|
| `2-01-backend` | CN-001 Application draft/submitted → CN-003 Identity/contact → Channel ownership verification → Admin review → active/needs_action/rejected → suspension/reverification → versioned evidence |
| `2-02-backend` | CN-010 Dashboard query → CN-011–015 Offer/rate versions → Eligibility → Invitation/enrollment → Link/content/referral asset → Aggregated click/order/earning → audit/freshness |
| `2-03-backend` | CN-020 Link or CN-021 Code or CN-022 Collection → Resolver/redirect → Click evidence → Order-line conversion → CN-023–025 reports → CN-026–027 earnings/payment/export |
| `2-04-backend` | CN-028 Touchpoints ≤ window → Candidate set → CN-031–034 class → Winner/version → CN-029–030 rate snapshot → CN-035–039 ledger/adjustment → evidence replay |
| `2-05-backend` | CN-041 Upload/transcode draft → CN-042/044 tags/voucher → Publish immutable version → CN-040 Feed/detail → CN-043 commerce click/order → CN-045 moderation → appeal/evidence |
| `2-06-backend` | CN-048 Schedule/preflight/ingest → CN-049 metadata → Live session → CN-050 product pin/tray → CN-051 chat/Q&A → CN-052 discovery conversion → replay/moderation evidence |
| `2-07-backend` | CN-053 PPS eligibility/terms → Enrollment → CN-054 product/rate version → CN-055 creator discovery/chat → CN-056 contact consent → revoke/expiry → audit |
| `2-08-backend` | CN-057 Conversation → CN-058 proposal/contract → CN-060 funded fee → CN-059 sample shipment → CN-061 deliverable/review → CN-062 release → CN-063–065 cancellation/dispute/evidence |
| `2-09-backend` | CN-066 MCN application → CN-067 roster invitation/membership → CN-069 RBAC → CN-068 assignment → CN-070 report → CN-071 split → CN-072 settlement/notification/audit |
| `2-10-backend` | CN-077 identity/tax/payment gates → Wallet/period → CN-073 statement → Provider payout → Reconciliation → CN-074–076 notify/hold/retry/correct → compensating evidence |
| `2-11-backend` | CN-080 Report/evidence → Risk triage → Entity graph → CN-078–079 decision policy → CN-081 hold/reverse/enforce → appeal → CN-082 recall/takedown + preserved evidence |
| `2-12-backend` | CN-083 Property registration/verification → Disclosure helper → CN-084 OAuth/scopes → Catalog/feed sync → External tag → Click/order/earning report → disconnect/health/audit |

Badges are assigned from the source implementation map already present in each Page 2; where the SRS states the domain is absent, use `New`; for reusable primitives use `Extend` or `Existing`; for native/secret-algorithm claims use `Field-validation gate`.

- [ ] **Step 4: Run the full spec tests and verify GREEN**

Run: `node --test scripts/notion-srs-visuals/specs.test.ts`

Expected: all overview, test, and backend spec tests PASS.

- [ ] **Step 5: Commit backend specs**

```bash
git add scripts/notion-srs-visuals/backend-specs.ts scripts/notion-srs-visuals/specs.test.ts
git commit -m "feat(docs): define affiliate backend lifecycle diagrams"
```

### Task 5: Define all twelve UI navigation diagrams

**Files:**
- Create: `scripts/notion-srs-visuals/ui-specs.ts`
- Modify: `scripts/notion-srs-visuals/specs.test.ts`

**Interfaces:**
- Consumes: Page 3 screen maps, `MH` code ranges, routes, and component contracts.
- Produces: `UI_SPECS`, exactly twelve specs with keys `3-01-ui` through `3-12-ui`.

- [ ] **Step 1: Extend tests for UI scope and native gate**

Assert twelve keys; every `MH` in each manifest range appears exactly once as a primary node; each spec contains entry/auth, authoritative API result, loading/error/denied handling, and remediation or safe exit. Assert Video and LIVE include a `Native gate` node stating responsive web is not closure evidence.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test scripts/notion-srs-visuals/specs.test.ts`

Expected: FAIL because `UI_SPECS` is missing.

- [ ] **Step 3: Define the twelve navigation specs**

Use these exact screen sequences and branch annotations:

| Key | Screen/navigation path |
|---|---|
| `3-01-ui` | Entry/auth → MH-001 eligibility → MH-002 application → MH-003 channel verification → MH-004 settings; Admin deep-link → MH-005 review; needs_action/rejected returns to exact form section |
| `3-02-ui` | MH-006 dashboard → MH-007 marketplace → MH-008 offer detail/asset; invitation deep-link → MH-009; referral → MH-010; seller/admin → MH-011; stale offer forces version refresh |
| `3-03-ui` | MH-012 link or MH-013 code or MH-014 collection → MH-015 public collection/PDP; reports → MH-016 conversions → MH-017 earnings/payment; resolver errors preserve source context |
| `3-04-ui` | Report row → MH-018 attribution detail → MH-020 ledger; seller config → MH-019 simulator/version; admin evidence → MH-021 explorer/replay; permission denied exits safely |
| `3-05-ui` | MH-022 feed → MH-025 detail/product sheet; create → MH-023 composer → MH-024 picker → publish; enforcement → MH-026 appeal; Native gate remains open |
| `3-06-ui` | MH-027 discovery → MH-030 viewer room; host → MH-028 setup → MH-029 console; replay/enforcement → MH-031; reconnect/ended branches; Native gate remains open |
| `3-07-ui` | Seller → MH-032 enrollment → MH-033 rates → MH-034 directory → internal chat; creator → MH-035 consent; revoked consent hides contact but preserves chat |
| `3-08-ui` | MH-036 inbox → MH-037 proposal → MH-038 sample → MH-039 deliverable review → release; seller affiliate branch → MH-040; revision/dispute returns to immutable contract version |
| `3-09-ui` | MH-041 application → MH-042 roster → MH-043 RBAC → MH-044 assignment → MH-045 report/settlement; leave/revoke updates effective membership and permissions |
| `3-10-ui` | MH-046 wallet → MH-047 tax/payment setup → MH-048 statement; notification deep-link → MH-049 remediation; finance role → MH-050 reconciliation; held/failed routes to safe action |
| `3-11-ui` | MH-051 report → admin MH-052 queue → MH-053 case graph → enforcement; user MH-054 appeal; policy operator MH-055 recall; all destructive actions confirm and return reference |
| `3-12-ui` | MH-056 property registry → MH-057 YouTube OAuth → MH-058 feed health/tag remediation → MH-059 report; disconnect/reconnect preserves history and safe status |

Each UI spec uses a separate column for surface boundary (`Storefront`, `Vendor portal`, `Medusa Admin`, `External OAuth`) and a final column for `BFF/API authoritative result`, `loading/error/denied`, and `audit/reference`.

- [ ] **Step 4: Run all spec tests and verify GREEN**

Run: `node --test scripts/notion-srs-visuals/specs.test.ts`

Expected: all 28 spec contracts PASS.

- [ ] **Step 5: Commit UI specs**

```bash
git add scripts/notion-srs-visuals/ui-specs.ts scripts/notion-srs-visuals/specs.test.ts
git commit -m "feat(docs): define affiliate UI navigation diagrams"
```

### Task 6: Generate and validate the 28 SVG assets

**Files:**
- Create: `scripts/notion-srs-visuals/generate.ts`
- Create: `scripts/notion-srs-visuals/validate.ts`
- Create: `scripts/notion-srs-visuals/generate.test.ts`
- Create: `docs/superpowers/assets/notion-srs-visuals/*.svg` (28 files)
- Create: `docs/superpowers/assets/notion-srs-visuals/contact-sheet.html`

**Interfaces:**
- Consumes: all 28 specs, renderer, and manifest.
- Produces: deterministic SVG files and a local contact sheet; `validateGeneratedAssets(outputDir): string[]` returns an empty error list only when every contract passes.

- [ ] **Step 1: Write failing generation/validation tests**

Tests must assert:

- merged specs contain exactly the same keys as `DIAGRAM_TARGETS`;
- generation into a temporary directory writes 28 SVGs and one contact sheet;
- every SVG is below 200 KiB, includes filename-independent `<title>/<desc>`, correct viewBox, no unsafe tokens, no placeholders, no external resources, and no code outside the target range;
- contact sheet contains 28 `<object type="image/svg+xml">` entries;
- output is deterministic across two temporary runs.

- [ ] **Step 2: Run generation tests and verify RED**

Run: `node --test scripts/notion-srs-visuals/generate.test.ts`

Expected: FAIL because `generate.ts` and `validate.ts` do not exist.

- [ ] **Step 3: Implement generator and validator**

`generate.ts` exports `generateAll(outputDir: string): Promise<void>` and, when executed directly, writes to `docs/superpowers/assets/notion-srs-visuals`. It merges the three spec collections, rejects missing/extra keys, renders files in manifest order, and writes an HTML contact sheet with the title, key, code range, and embedded local SVG object.

`validate.ts` exports `validateGeneratedAssets(outputDir: string): Promise<string[]>`. It reports all errors instead of stopping at the first one and exits non-zero in its CLI entrypoint when errors are present.

- [ ] **Step 4: Run tests and generate assets**

Run:

```bash
node --test scripts/notion-srs-visuals/*.test.ts
node scripts/notion-srs-visuals/generate.ts
node scripts/notion-srs-visuals/validate.ts
xmllint --noout docs/superpowers/assets/notion-srs-visuals/*.svg
```

Expected: all tests PASS; generator reports `28 SVGs generated`; validator reports `28/28 valid`; `xmllint` exits 0.

- [ ] **Step 5: Perform visual review using the contact sheet**

Open `docs/superpowers/assets/notion-srs-visuals/contact-sheet.html` locally. Review all 28 diagrams at desktop width and 50% zoom. Reject and fix any clipped label, crossing edge that obscures text, unreadable badge, inconsistent legend, missing actor, wrong code range, or layout that requires horizontal scrolling in Notion.

- [ ] **Step 6: Re-run validation after visual fixes**

Run the four commands from Step 4 again.

Expected: all remain GREEN and the generated files are deterministic.

- [ ] **Step 7: Commit reproducible assets and tooling**

```bash
git add scripts/notion-srs-visuals docs/superpowers/assets/notion-srs-visuals
git commit -m "docs: generate affiliate SRS visual diagrams"
```

### Task 7: Upload and place every diagram in Notion without changing versions

**Files:**
- Read: `scripts/notion-srs-visuals/manifest.ts`
- Read: `docs/superpowers/assets/notion-srs-visuals/*.svg`
- Modify externally: 26 Notion child pages listed in the manifest

**Interfaces:**
- Consumes: validated SVG content and exact manifest anchors.
- Produces: 28 attached Notion image blocks with captions; all page-level versions remain unchanged during this task.

- [ ] **Step 1: Fetch and preflight all 26 target pages**

For each unique `pageId`, fetch the page and assert:

- the page title matches `pageLabel`/module;
- every `insertBefore` anchor occurs exactly once;
- the expected previous version is present;
- the target filename and caption are not already present;
- Page 3 still contains all component contract tables and the expected MH count.

Stop before mutation if any assertion fails.

- [ ] **Step 2: Upload and attach each SVG sequentially**

For each manifest item in order:

1. Read the SVG as UTF-8 and call the Notion attachment tool with `filename`, `content_type: image/svg+xml`, and `content`.
2. Capture the returned `markdown_source`.
3. Immediately call `update_content` on the target page with `properties: {}` and one replacement:

```text
old_str = item.insertBefore
new_str = ## Sơ đồ — {item.title}
          ![{item.alt}]({markdown_source})
          > {item.caption} [Trang đối ứng]({item.relatedPageUrl})

          {item.insertBefore}
```

Omit the related-page link only for Page 1 and Page 4. Never batch unattached uploads.

- [ ] **Step 3: Read back after every placement**

Fetch the page immediately and verify the new filename/image source, title, alt/caption text, unchanged version, preserved anchor, and expected image count. Record successful manifest keys. Retry only a failed key; never upload a second copy for a successful key.

- [ ] **Step 4: Verify placement totals before versioning**

Fetch all 27 pages (master plus children) and assert:

- master: 1 existing infographic;
- Page 1: 2 new images;
- each Page 2: 1 new image;
- each Page 3: 1 new image;
- Page 4: 2 new images;
- total: 29 visual blocks;
- 59/59 MH component contracts and 470 component rows remain present;
- master child-page count remains 26.

Do not continue if any count or preserved-content check fails.

### Task 8: Synchronize SRS version 0.5 and add the master changelog

**Files:**
- Modify externally: master Notion page and all 26 child pages

**Interfaces:**
- Consumes: successful 28/28 placement verification from Task 7.
- Produces: master and all children at version 0.5, with one auditable master changelog entry.

- [ ] **Step 1: Update child page version markers**

Use targeted `update_content` replacements:

- Page 1, all Page 2, and Page 4: `Phiên bản áp dụng: 0.2` → `Phiên bản áp dụng: 0.5`.
- All Page 3: `Phiên bản áp dụng: 0.4` → `Phiên bản áp dụng: 0.5`.

Fetch after each update and verify exactly one 0.5 marker and no stale marker.

- [ ] **Step 2: Update the master current version and history**

Change `Phiên bản hiện tại` from `0.4` to `0.5`. Insert this row before the 0.4 history row:

```text
0.5 | 18/07/2026 | Bổ sung 28 SVG technical diagrams: 2 Page 1, 12 backend lifecycle, 12 UI navigation và 2 traceability/release-gate; đồng bộ 26 page-level version; không đổi functional baseline. | Codex theo review/approval của Noah Duong | Chưa duyệt
```

- [ ] **Step 3: Fetch and verify version consistency**

Expected: master and 26/26 child pages report 0.5; history order begins 0.5, 0.4, 0.3; no page reports 0.2 or 0.4 as its current/applied version.

### Task 9: Run the final content, visual, and repository audit

**Files:**
- Read: all generated assets and Notion pages
- Modify: `docs/superpowers/plans/2026-07-18-notion-srs-visual-diagrams.md` checkboxes only during execution

**Interfaces:**
- Consumes: completed local assets and Notion v0.5 pages.
- Produces: evidence-backed completion report; no deployment.

- [ ] **Step 1: Run focused local validation**

```bash
node --test scripts/notion-srs-visuals/*.test.ts
node scripts/notion-srs-visuals/validate.ts
xmllint --noout docs/superpowers/assets/notion-srs-visuals/*.svg
```

Expected: all PASS; 28/28 SVGs valid.

- [ ] **Step 2: Run repository definition-of-done gates**

```bash
mise typecheck
mise check:ci
mise lint
mise test
```

Expected: zero errors and all tests pass. `mise build` is not required because no application/build configuration changes; run it only if implementation expands beyond documentation tooling/assets.

- [ ] **Step 3: Perform final Notion read-back audit**

Verify all of the following in one report:

- 28/28 new diagrams and 29 total visual blocks;
- 12/12 backend diagrams and 12/12 UI diagrams match page code ranges;
- 26/26 child pages plus master use version 0.5;
- Page 1, Page 2, Page 3 and Page 4 text/table/child-page counts are not lower than pre-update baselines;
- Page 3 retains 59 component contracts and 470 component rows;
- no SVG contains unsafe content, placeholder text, out-of-range codes, secret-algorithm claims, PII or provider secrets;
- no duplicate diagram title, filename, image block or caption;
- no broken related-page link.

- [ ] **Step 4: Commit execution tracking and report completion**

```bash
git add docs/superpowers/plans/2026-07-18-notion-srs-visual-diagrams.md
git commit -m "docs: complete Notion SRS visual rollout"
```

Report the master link, counts, version, local validation results, repository gate results, and any pre-existing unrelated worktree changes that were intentionally preserved.
