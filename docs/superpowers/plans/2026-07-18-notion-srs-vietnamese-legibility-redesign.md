# Vietnamese Notion SRS Diagram Legibility Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 28 existing SRS SVGs with Vietnamese, portrait, two-band diagrams that remain readable at Notion width and contain no overlapping node, label, or routed-edge geometry.

**Architecture:** Keep the 28 semantic diagram specs and manifest as the source of truth, but author all visible copy in Vietnamese. Introduce a pure layout module that splits four columns into `2 + 2` bands and five columns into `3 + 2`, classifies edges into drawable in-band paths or paired references, and exposes geometry metadata to both the SVG renderer and validator. Regenerate the same filenames, then replace each existing Notion visual block exactly once without changing image counts or SRS version `0.5`.

**Tech Stack:** Node.js 22 native erasable TypeScript, Node test runner, deterministic SVG, `rsvg-convert`/ImageMagick for review previews, Notion MCP attachment/fetch/update tools

## Global Constraints

- Main SVG viewBox is exactly `0 0 1400 1800`.
- Each diagram has two vertical flow bands and no band contains more than three columns.
- Visible explanatory copy is Vietnamese; codes, routes, APIs, source paths, and approved proper nouns remain unchanged.
- Node detail font is at least 24 px, edge-code markers/directory text are at least 22 px, and renderer-generated ellipsis is forbidden.
- A node detail may use at most four lines; overflow must fail generation.
- Forward in-band edges use unique orthogonal lanes; same-column edges use unique side rails.
- Cross-band, backward, evidence, and non-local async connections use paired references instead of long paths.
- Every semantic edge receives a stable code in original `spec.edges` order: drawable local paths use `L1`, `L2`, ...; non-local references retain `①`, `N*`, `R*`, `E*`, or `A*` families.
- Visible path/reference markers are code-only: local markers stay in their allocated gutter stripe, while paired-reference endpoints stay inside their exact owner nodes; the complete edge label is not rendered at either endpoint.
- The footer edge directory lists every edge as `{code} — {edge.label}` in source-spec order, with at most four columns × six rows (24 entries), no truncation or ellipsis, and generation failure when any entry cannot fit losslessly.
- No node/label collision, path-through-node, duplicate path segment, unpaired reference, or out-of-bounds connector is permitted.
- Filenames, page IDs, code identifiers/numeric ranges, 28-target inventory, and functional baseline remain unchanged; English prose appended to a code range is translated.
- Notion remains version `0.5`; replacement must preserve 29 total visual blocks, 26 child pages, 59 MH headings, 59 component contracts, and 470 component rows.
- Do not edit application source, generated protocol/Panda code, or unrelated dirty-worktree files. Do not deploy.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/notion-srs-visuals/types.ts` | Vietnamese badge types plus layout/reference contracts |
| `scripts/notion-srs-visuals/localization-policy.ts` | Visible-copy allowlist and Vietnamese-copy audit |
| `scripts/notion-srs-visuals/localization-policy.test.ts` | Localization regression tests for all 28 specs/targets |
| `scripts/notion-srs-visuals/diagram-layout.ts` | Pure two-band layout and edge/reference classification |
| `scripts/notion-srs-visuals/diagram-layout.test.ts` | Band split, typography, wrapping, lane and reference tests |
| `scripts/notion-srs-visuals/geometry-audit.ts` | Rectangle/segment/reference integrity audit |
| `scripts/notion-srs-visuals/geometry-audit.test.ts` | Collision, shared-segment and bounds regression tests |
| `scripts/notion-srs-visuals/svg-renderer.ts` | Render portrait SVG from layout metadata |
| `scripts/notion-srs-visuals/svg-renderer.test.ts` | Semantic SVG, typography and connector rendering tests |
| `scripts/notion-srs-visuals/graph-identity.ts` | Frozen hashes for graph structure that copy-only translation must preserve |
| `scripts/notion-srs-visuals/{manifest,overview-and-test-specs,backend-specs,ui-specs}.ts` | Vietnamese target/spec content |
| `scripts/notion-srs-visuals/{manifest,specs,backend-specs,ui-specs}.test.ts` | Inventory and semantic preservation tests |
| `scripts/notion-srs-visuals/{generate,generate.test,validate}.ts` | Deterministic generation, contact sheet and final validation |
| `docs/superpowers/assets/notion-srs-visuals/*` | Regenerated 28 SVGs and review contact sheet |
| `docs/superpowers/plans/2026-07-18-notion-srs-vietnamese-legibility-redesign.md` | Execution checklist and evidence |

### Task 1: Define Vietnamese copy and replacement contracts

**Files:**
- Modify: `scripts/notion-srs-visuals/types.ts`
- Create: `scripts/notion-srs-visuals/localization-policy.ts`
- Create: `scripts/notion-srs-visuals/localization-policy.test.ts`
- Modify: `scripts/notion-srs-visuals/manifest.ts`
- Modify: `scripts/notion-srs-visuals/manifest.test.ts`

**Interfaces:**
- Consumes: current `TDiagramTarget`, `TDiagramSpec`, and 28 target keys.
- Produces: Vietnamese `TBadge`, `TLegacyVisualCopy`, `auditVietnameseCopy(targets, specs): string[]`, and replacement metadata used by Notion updates.

- [x] **Step 1: Write failing localization and manifest tests**

Add these assertions:

```ts
const APPROVED_BADGES = new Set([
  'Hiện có',
  'Mở rộng',
  'Mới',
  'Cổng xác thực thực địa',
]);

test('should expose Vietnamese visual copy and retain legacy replacement copy', () => {
  for (const target of DIAGRAM_TARGETS) {
    assert.equal(target.currentVersion, '0.5');
    assert.ok(target.legacy.title.length > 0);
    assert.ok(target.legacy.alt.length > 0);
    assert.ok(target.legacy.caption.length > 0);
    assert.match(target.caption, /nội dung SRS|văn bản SRS/i);
  }
});

test('should pass the Vietnamese visible-copy policy for translated targets', () => {
  assert.deepEqual(
    auditVietnameseCopy(DIAGRAM_TARGETS, []),
    [],
  );
});

test('should reject English explanatory copy before spec translation', () => {
  assert.ok(auditVietnameseCopy([], [englishOnlySpec]).length > 0);
});
```

Define `englishOnlySpec` as the smallest valid `TDiagramSpec` fixture with English title, scope, column, node and edge copy. Task 1 deliberately does not pass production `ALL_SPECS`; that gate becomes GREEN only in Task 2 after translation.

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
mise exec -- node --test \
  scripts/notion-srs-visuals/manifest.test.ts \
  scripts/notion-srs-visuals/localization-policy.test.ts
```

Expected: FAIL because `currentVersion`, `legacy`, Vietnamese badge values, and `auditVietnameseCopy` do not exist.

- [x] **Step 3: Add exact types and localization audit**

Use these public types:

```ts
export type TBadge =
  | 'Hiện có'
  | 'Mở rộng'
  | 'Mới'
  | 'Cổng xác thực thực địa';

export type TLegacyVisualCopy = Readonly<{
  title: string;
  alt: string;
  caption: string;
}>;

export type TDiagramTarget = Readonly<{
  key: string;
  filename: string;
  kind: TDiagramKind;
  pageId: string;
  pageLabel: string;
  title: string;
  codeRange: string;
  previousVersion: Exclude<TVersion, '0.5'>;
  nextVersion: '0.5';
  currentVersion: '0.5';
  insertBefore: string;
  alt: string;
  caption: string;
  legacy: TLegacyVisualCopy;
  relatedPageUrl?: string;
}>;
```

`localization-policy.ts` must export:

```ts
export const auditVietnameseCopy = (
  targets: readonly TDiagramTarget[],
  specs: readonly TDiagramSpec[],
): string[] => {
  const errors: string[] = [];
  const vietnameseSignal = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
  const technicalOnlyPatterns = [
    /^(?:SP|CN|QT|MH|KT)-\d{3}(?:–(?:SP|CN|QT|MH|KT)-\d{3})?$/,
    /^SRS-BENA-AFF-US-\d{3}$/,
    /^\/(?:[A-Za-z0-9_{}:.*-]+\/)*[A-Za-z0-9_{}:.*-]+$/,
    /^(?:GET|POST|PUT|PATCH|DELETE) \/[A-Za-z0-9_/{ }:.*-]+$/,
    /^(?:apps|services|packages|scripts|docs|src)\/[A-Za-z0-9_./{}*-]+$/,
    /^(?:Storefront|Vendor Portal|Medusa Admin|YouTube(?: Shopping| feed\/tag)?|OAuth|BFF\/API|RBAC|LIVE Commerce|Buyer|Viewer|Creator|Host|Sample)$/,
  ];
  const forbidden = [
    /Visual aid/i,
    /normative text/i,
    /request \/ navigation/i,
    /audit \/ evidence/i,
    /Loading\/error\/denied/i,
    /Remediation \/ safe exit/i,
  ];
  const visibleValues = [
    ...targets.flatMap((target) => [
      target.title,
      target.codeRange,
      target.alt,
      target.caption,
    ]),
    ...specs.flatMap((spec) => [
      spec.title,
      spec.subtitle,
      spec.scope,
      ...spec.columns.flatMap((column) => [
        column.title,
        ...column.nodes.flatMap((node) => [node.label, node.detail]),
      ]),
      ...spec.edges.map((edge) => edge.label),
    ]),
  ];
  for (const [index, value] of visibleValues.entries()) {
    for (const pattern of forbidden) {
      if (pattern.test(value)) errors.push(`visible[${index}]: ${pattern}`);
    }
    const isTechnicalOnly = technicalOnlyPatterns.some((pattern) => pattern.test(value));
    if (!vietnameseSignal.test(value) && !isTechnicalOnly) {
      errors.push(`visible[${index}]: missing Vietnamese explanatory copy`);
    }
  }
  return errors;
};
```

Keep the current English `title`, `alt`, and `caption` under `legacy` before replacing them with Vietnamese values. Retain the existing historical `previousVersion` and `nextVersion` fields for regression compatibility, and set every target to `currentVersion: '0.5'`.

- [x] **Step 4: Translate the 28 target titles**

Use these exact titles:

| Key | Vietnamese title |
|---|---|
| `page-1-system-context` | Bối cảnh hệ thống & bản đồ tác nhân |
| `page-1-end-to-end` | Luồng dữ liệu, tiền & bằng chứng đầu cuối |
| `2-01-backend` | Vòng đời định danh, onboarding & tài khoản |
| `2-02-backend` | Dashboard, ưu đãi, hoa hồng & giới thiệu |
| `2-03-backend` | Link, mã sản phẩm, bộ sưu tập & báo cáo |
| `2-04-backend` | Attribution, snapshot tỷ lệ & sổ cái hoa hồng |
| `2-05-backend` | Vòng đời thương mại Video ngắn |
| `2-06-backend` | Vòng đời LIVE Commerce |
| `2-07-backend` | PPS người bán, tỷ lệ & liên hệ Creator |
| `2-08-backend` | PPP, cộng tác, hàng mẫu & Seller Affiliate |
| `2-09-backend` | MCN roster, RBAC & phân chia doanh thu |
| `2-10-backend` | Đối soát, payout, thuế & khắc phục |
| `2-11-backend` | Gian lận, enforcement & khiếu nại |
| `2-12-backend` | Phân phối ngoài nền tảng & YouTube Shopping |
| `3-01-ui` | Điều hướng UI định danh & onboarding |
| `3-02-ui` | Điều hướng UI dashboard, ưu đãi & giới thiệu |
| `3-03-ui` | Điều hướng UI link, bộ sưu tập & báo cáo |
| `3-04-ui` | Điều hướng UI attribution & ledger |
| `3-05-ui` | Điều hướng UI thương mại Video ngắn |
| `3-06-ui` | Điều hướng UI LIVE Commerce |
| `3-07-ui` | Điều hướng UI Seller PPS & liên hệ Creator |
| `3-08-ui` | Điều hướng UI cộng tác PPP |
| `3-09-ui` | Điều hướng UI MCN & agency |
| `3-10-ui` | Điều hướng UI payout, thuế & đối soát |
| `3-11-ui` | Điều hướng UI gian lận, enforcement & khiếu nại |
| `3-12-ui` | Điều hướng UI phân phối ngoài nền tảng |
| `page-4-traceability` | Chuỗi truy vết yêu cầu |
| `page-4-release-gate` | Cổng kiểm thử, bằng chứng & phát hành |

Translate every target alt/caption into a complete Vietnamese sentence. Captions end with: `Hình minh họa; nội dung SRS chuẩn tắc vẫn là nguồn quyết định.`

Translate the explanatory suffixes of the four mixed code-range values without changing any identifier or numeric range:

| Current | Vietnamese visible value |
|---|---|
| `SRS-BENA-AFF-US-001 actors and trust boundaries` | `SRS-BENA-AFF-US-001 — tác nhân và ranh giới tin cậy` |
| `SP-001–SP-084 overview` | `SP-001–SP-084 — tổng quan` |
| `SP → CN → QT → MH/non-UI → KT → evidence` | `SP → CN → QT → MH/non-UI → KT → bằng chứng` |
| `KT-001–KT-120 and release evidence` | `KT-001–KT-120 và bằng chứng phát hành` |

- [x] **Step 5: Run tests and commit**

Run the Task 1 command. Expected: PASS.

```bash
git add scripts/notion-srs-visuals/types.ts \
  scripts/notion-srs-visuals/localization-policy.ts \
  scripts/notion-srs-visuals/localization-policy.test.ts \
  scripts/notion-srs-visuals/manifest.ts \
  scripts/notion-srs-visuals/manifest.test.ts
git commit -m "feat(docs): define Vietnamese diagram copy contract"
```

### Task 2: Translate all semantic diagram specs without changing traceability

**Files:**
- Create: `scripts/notion-srs-visuals/graph-identity.ts`
- Modify: `scripts/notion-srs-visuals/overview-and-test-specs.ts`
- Modify: `scripts/notion-srs-visuals/backend-specs.ts`
- Modify: `scripts/notion-srs-visuals/ui-specs.ts`
- Modify: `scripts/notion-srs-visuals/specs.test.ts`
- Modify: `scripts/notion-srs-visuals/backend-specs.test.ts`
- Modify: `scripts/notion-srs-visuals/ui-specs.test.ts`
- Modify: `scripts/notion-srs-visuals/localization-policy.test.ts`

**Interfaces:**
- Consumes: Vietnamese badges and localization audit from Task 1.
- Produces: 28 Vietnamese `TDiagramSpec` values with unchanged keys, node IDs, code identifiers/numeric ranges, roles, source paths, and graph semantics.

- [x] **Step 1: Write failing semantic-preservation tests**

Add assertions that snapshot the immutable parts before copy translation:

```ts
test('should preserve diagram graph identity while translating visible copy', () => {
  for (const spec of ALL_SPECS) {
    const identity = {
      key: spec.key,
      columns: spec.columns.map((column) => column.nodes.map((node) => node.id)),
      edges: spec.edges.map((edge) => [edge.from, edge.to, edge.style]),
    };
    const hash = createHash('sha256')
      .update(JSON.stringify(identity))
      .digest('hex');
    assert.equal(hash, EXPECTED_GRAPH_HASHES[spec.key], spec.key);
  }
});

test('should pass the Vietnamese visible-copy policy for all production specs', () => {
  assert.deepEqual(auditVietnameseCopy(DIAGRAM_TARGETS, ALL_SPECS), []);
  for (const spec of ALL_SPECS) {
    for (const node of spec.columns.flatMap((column) => column.nodes)) {
      if (node.badge) assert.ok(APPROVED_BADGES.has(node.badge));
    }
  }
});
```

Create `graph-identity.ts` with these frozen pre-translation values:

```ts
export const EXPECTED_GRAPH_HASHES: Readonly<Record<string, string>> = {
  'page-1-system-context': 'e9b407956f7271ff8b357c2e6869b0cb83fb99026bf7cf9a1afc10daaf4d751f',
  'page-1-end-to-end': 'da44847bab0d4f0e33a5c0e93da87986d9245f4e36493f1447daefceea608b1c',
  'page-4-traceability': '2a4a8bb9c91958c0bf95f3d291f5e18fe9ff7d970b84468fd702f4b2eda5a473',
  'page-4-release-gate': '0cef2e967c29c663c6f81547deaba5c48b2e4bdd740d9517f5b428cdfd534669',
  '2-01-backend': 'cba14362bf00bc150b936138881d6127e302f6a73421995f2223a8b20695434e',
  '2-02-backend': '3f4c8426d2d881eb82d557f5c2f3441eb2a628f961258cee48b6e2b300b870c3',
  '2-03-backend': '120ca9d5d94973a15409dd34350bd614e3d4989d6a398205309963370bdbfa7f',
  '2-04-backend': 'c1d111ceea304a958cd57026c524c496c4164d82f0285bca0419011be75e7c60',
  '2-05-backend': 'd43f73dc682f6893732250535303a832bd6529f2d9a11f237123cfc0b3d73d15',
  '2-06-backend': '9cc3e61ee2f6fc4a5ec8b9332532fd4aeae6e1526c30d85caab1aa97d799851c',
  '2-07-backend': '9a9d02b11ce0ebda218f2c96db9c81a85b31be8564b9013f8b821c4acbcca446',
  '2-08-backend': '31dafed108cc960d5dc8fb2e891b481323d316a71b891da62309701e62a25915',
  '2-09-backend': '83ab4f5f9b470f5ea83189b975fe2efb44d04121d4c92124cead1d382d8bf7ea',
  '2-10-backend': 'c992c201e1c80829f9b52ccfe98531a8bdf5f248091bcd97133213c1b894838c',
  '2-11-backend': '04a81fa3fd8a73ef77a75cee633aff048804271ec4195a366af1953b7e1ae2df',
  '2-12-backend': '1f8fd4d63738063ffaffbf14a3eb4ac22f1cc027bfd648d3d66c53f7e39367d1',
  '3-01-ui': 'ee991945490e0ec1d500d864718f3956b958883d993fe62790112849ca0ee568',
  '3-02-ui': '35420df71cd2f28f54849753dc825bfcd403ec188363ec25f77ca4a1b9205379',
  '3-03-ui': 'f532795654a5710164efc4cbc5c1337ca1ac5c33ed76380992c5df9fed6f435c',
  '3-04-ui': 'a290f70b765c4210374604e11f29be8ea5a02adcb0c247074fdafe35a13d3a26',
  '3-05-ui': 'd1838a6748d0e349259a170e22ff9db288e70415afca58f30a42811603e2c0a9',
  '3-06-ui': '061f134028270203983b564c53446f0408758bda35fd0a0b7c42fbf8b41e86e2',
  '3-07-ui': '99dd6cd932c393d36b1a6e66be5b9bb636bb3f8263dc9f5460b850a0c3e4bc02',
  '3-08-ui': '4b70f37c552a1cf82b29f4dcc33a5ad417b9420a6316a9612e8ee4cf19cd00ec',
  '3-09-ui': 'e51fd477025c5cda01676691db15caaa9d6bc8fad64061d514bb4a64d9309e3a',
  '3-10-ui': '7fc7a1ee9cff2ab36f23f3486b4e67268c16958b4c3968df225c0b6537477723',
  '3-11-ui': '8dbfc0a7a4aca18129d0ab14ca741ac3de9e2120277937bb02db8d974fbd6a5b',
  '3-12-ui': 'b1fa29d876cafafd6ec2163e459d9e4d03948a3f6c43333b1049f2afa73c21b3',
};
```

Keep the existing tests for 59 unique MH nodes, lifecycle reachability, MCN Storefront mapping, money-state semantics, native evidence, and truthful `Mới/Mở rộng/Hiện có` source fit.

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
mise exec -- node --test \
  scripts/notion-srs-visuals/specs.test.ts \
  scripts/notion-srs-visuals/backend-specs.test.ts \
  scripts/notion-srs-visuals/ui-specs.test.ts \
  scripts/notion-srs-visuals/localization-policy.test.ts
```

Expected: localization test FAILS on the current English copy while graph-identity assertions pass.

- [x] **Step 3: Translate overview and Page 4 specs**

Translate all titles, scope, columns, nodes and edges in the four specs. Use these footer concepts consistently:

- `Luồng chính / điều hướng`
- `Bất đồng bộ / webhook`
- `Audit / bằng chứng`
- `Hình minh họa; nội dung SRS chuẩn tắc vẫn là nguồn quyết định`

Keep the explicit statement that unobservable internals require field validation and do not claim Shopee secret-algorithm parity.

- [x] **Step 4: Translate twelve backend specs**

For every `2-xx-backend` spec:

- preserve code labels and node IDs;
- translate lifecycle verbs, safe remediation, evidence and source-fit explanations;
- use `Mới`, `Mở rộng`, `Hiện có`, or `Cổng xác thực thực địa` only;
- keep 2.04 deterministic candidate/class/winner wording without `ranking` claims;
- keep 2.10 order `approved earning → open period → reconciliation → payee gate → held/payable`;
- keep CN-059 Sample and YouTube feed/tag as `Mới`;
- keep CN-004 native evidence as ADR + native implementation + authenticated evidence.

- [x] **Step 5: Translate twelve UI specs**

For every `3-xx-ui` spec:

- translate surface, state, remediation, audit and navigation copy;
- keep `Storefront`, `Vendor Portal`, `Medusa Admin`, routes, APIs and source paths unchanged;
- preserve public Buyer/Viewer versus authenticated Creator/Host entry distinctions;
- keep Video/LIVE native gates connected and open;
- keep MCN at `apps/storefront/src/app/mcn/*`;
- describe `reversed` as `bút toán bù trừ`, not a balance state.

- [x] **Step 6: Run tests and commit**

Run the Task 2 command plus:

```bash
pnpm exec biome check scripts/notion-srs-visuals
git diff --check
```

Expected: all semantic/localization tests PASS; Biome and diff check PASS.

```bash
git add scripts/notion-srs-visuals/overview-and-test-specs.ts \
  scripts/notion-srs-visuals/backend-specs.ts \
  scripts/notion-srs-visuals/ui-specs.ts \
  scripts/notion-srs-visuals/graph-identity.ts \
  scripts/notion-srs-visuals/specs.test.ts \
  scripts/notion-srs-visuals/backend-specs.test.ts \
  scripts/notion-srs-visuals/ui-specs.test.ts \
  scripts/notion-srs-visuals/localization-policy.test.ts
git commit -m "docs: translate affiliate SRS diagrams to Vietnamese"
```

### Task 3: Build the pure two-band layout engine

**Files:**
- Create: `scripts/notion-srs-visuals/diagram-layout.ts`
- Create: `scripts/notion-srs-visuals/diagram-layout.test.ts`
- Modify: `scripts/notion-srs-visuals/types.ts`

**Interfaces:**
- Consumes: `TDiagramSpec`.
- Produces: `layoutDiagram(spec): TDiagramLayout`, `measureVisibleText(value, fontSize): number`, `wrapVisibleText(value, maxWidth, fontSize): string[]`, and deterministic band/node/lane/reference metadata.

- [x] **Step 1: Write failing band and typography tests**

Use exact contracts:

```ts
test('should split four and five semantic columns into two portrait bands', () => {
  assert.deepEqual(layoutDiagram(fourColumnSpec).bands.map((band) => band.columnIndexes), [[0, 1], [2, 3]]);
  assert.deepEqual(layoutDiagram(fiveColumnSpec).bands.map((band) => band.columnIndexes), [[0, 1, 2], [3, 4]]);
});

test('should expose Notion-readable typography and bounds', () => {
  const layout = layoutDiagram(fiveColumnSpec);
  assert.deepEqual(layout.viewBox, { width: 1400, height: 1800 });
  assert.equal(layout.typography.nodeDetail, 24);
  assert.equal(layout.typography.connector, 22);
  assert.ok(layout.nodes.every((node) => node.title.lines.length <= 2));
  assert.ok(layout.nodes.every((node) => node.detail.lines.length <= 4));
  assert.ok(layout.nodes.every((node) => !node.detail.lines.join(' ').includes('…')));
});

test('should wrap a long source path without losing characters', () => {
  const value = 'apps/storefront/src/app/mcn/*';
  const lines = wrapVisibleText(value, 180, 24);
  assert.equal(lines.join(''), value);
  assert.ok(lines.every((line) => measureVisibleText(line, 24) <= 180));
});
```

- [x] **Step 2: Write failing edge-classification tests**

```ts
test('should draw only local forward and same-column edges', () => {
  const layout = layoutDiagram(classificationSpec);
  assert.deepEqual(layout.paths.map((path) => ({ kind: path.kind, code: path.code })), [
    { kind: 'forward-lane', code: 'L1' },
    { kind: 'same-column-rail', code: 'L2' },
  ]);
});

test('should convert non-local connections into paired references', () => {
  const layout = layoutDiagram(classificationSpec);
  assert.deepEqual(
    layout.references.map((reference) => ({
      kind: reference.kind,
      code: reference.code,
      endpoints: reference.endpoints.length,
    })),
    [
      { kind: 'handoff', code: '①', endpoints: 2 },
      { kind: 'jump', code: 'N1', endpoints: 2 },
      { kind: 'return', code: 'R1', endpoints: 2 },
      { kind: 'evidence', code: 'E1', endpoints: 2 },
      { kind: 'async', code: 'A1', endpoints: 2 },
    ],
  );
});

test('should create one lossless footer directory entry for every edge', () => {
  const layout = layoutDiagram(classificationSpec);
  assert.deepEqual(
    layout.footer.edgeItems.map((item) => item.text.lines.join('')),
    classificationSpec.edges.map((edge) => {
      const path = layout.paths.find((item) => item.edge === edge);
      const reference = layout.references.find((item) => item.edge === edge);
      return `${path?.code ?? reference?.code} — ${edge.label}`;
    }),
  );
  assert.ok(layout.footer.edgeItems.length <= 24);
  assert.ok(layout.footer.edgeItems.every((item) => item.text.lines.length === 1));
});
```

- [x] **Step 3: Run tests and verify RED**

Run: `mise exec -- node --test scripts/notion-srs-visuals/diagram-layout.test.ts`

Expected: FAIL with module-not-found for `diagram-layout.ts`.

- [x] **Step 4: Define layout types**

Add:

```ts
export type TRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type TPoint = Readonly<{ x: number; y: number }>;
export type TSegment = Readonly<{ from: TPoint; to: TPoint }>;
export type TLayoutText = Readonly<{
  rect: TRect;
  lines: readonly string[];
  fontSize: number;
  lineHeight: number;
  align: 'start' | 'middle' | 'end';
}>;
export type TReferenceKind = 'handoff' | 'jump' | 'return' | 'evidence' | 'async';
export type TLayoutPath = Readonly<{
  edge: TDiagramEdge;
  kind: 'forward-lane' | 'same-column-rail';
  code: string;
  lane: string;
  segments: readonly TSegment[];
  label: TLayoutText;
}>;
export type TLayoutReference = Readonly<{
  edge: TDiagramEdge;
  kind: TReferenceKind;
  code: string;
  endpoints: readonly [
    Readonly<{
      role: 'source';
      nodeId: string;
      chipRect: TRect;
      label: TLayoutText;
    }>,
    Readonly<{
      role: 'target';
      nodeId: string;
      chipRect: TRect;
      label: TLayoutText;
    }>,
  ];
}>;
export type TLayoutEdgeDirectoryEntry = Readonly<{
  edge: TDiagramEdge;
  code: string;
  text: TLayoutText;
}>;
export type TDiagramLayout = Readonly<{
  viewBox: Readonly<{ width: 1400; height: 1800 }>;
  typography: Readonly<{
    title: 46;
    subtitle: 30;
    scope: 24;
    column: 26;
    nodeTitle: 30;
    nodeDetail: 24;
    badge: 20;
    connector: 22;
    footer: 22;
  }>;
  header: Readonly<{ title: TLayoutText; subtitle: TLayoutText; scope: TLayoutText }>;
  bands: readonly Readonly<{ index: 0 | 1; columnIndexes: readonly number[]; rect: TRect }>[];
  columns: readonly Readonly<{
    index: number;
    bandIndex: 0 | 1;
    rect: TRect;
    title: TLayoutText;
  }>[];
  nodes: readonly Readonly<{
    node: TDiagramNode;
    bandIndex: 0 | 1;
    columnIndex: number;
    rect: TRect;
    title: TLayoutText;
    detail: TLayoutText;
    badge?: Readonly<{ rect: TRect; text: string }>;
  }>[];
  paths: readonly TLayoutPath[];
  references: readonly TLayoutReference[];
  footer: Readonly<{
    edgeItems: readonly TLayoutEdgeDirectoryEntry[];
    legendItems: readonly TLayoutText[];
    warning: TLayoutText;
  }>;
}>;
```

- [x] **Step 5: Implement deterministic layout**

Use these constants:

```ts
const VIEWBOX = { width: 1400, height: 1800 } as const;
const BAND_RECTS = [
  { x: 48, y: 155, width: 1304, height: 690 },
  { x: 48, y: 900, width: 1304, height: 690 },
] as const;
const COLUMN_GAP = 48;
const NODE_GAP = 12;
const NODE_MIN_HEIGHT = 128;
const NODE_HORIZONTAL_PADDING = 14;
```

`measureVisibleText(value, fontSize)` must use one conservative deterministic glyph-width table (including Vietnamese combining/diacritic characters), never browser/canvas measurement. `wrapVisibleText(value, maxWidth, fontSize)` wraps prose at whitespace and long technical tokens at `/`, `.`, `-`, `_`, `:` or `*`, retaining every original character. It allows at most two node-title lines and four detail lines; all text rectangles are calculated here and exported in the layout.

Allocate stable edge codes in original `spec.edges` order. Drawable local paths share the `L1`, `L2`, ... sequence; non-local references retain their semantic `①`, `N*`, `R*`, `E*`, `A*`, and last-resort same-column `S*` families. A local path renders its code-only marker in the allocated gutter stripe. Both endpoints of a paired reference render only the matching code inside their exact owner nodes; the complete label is never visible at either endpoint, although each endpoint keeps an SVG `<title>` with the full label for accessibility.

Every local marker must remain within the canvas and its owning gutter stripe. Every reference chip must remain inside its exact owner node, after title/detail/badge content. Pack source chips before target chips, at most four chips per row, and include those rows in the node height. Expose every marker/chip rectangle and include its space in node and gutter fit calculations.

Preserve semantic node order by default. Only a column that explicitly declares `allowVisualReorder: true` may use deterministic permutation search to reduce local-edge crossing. For a non-adjacent same-column span in an interior column, test the preferred right rail and then the left rail; emit an `S*` paired reference only when both sides are blocked. Validate the bounded search space before any permutation: one to four nodes per column, at most 24 edges per diagram, and at most five local paths per gutter.

Build `footer.edgeItems` for every semantic edge in source-spec order using the exact visible form `{code} — {edge.label}`. Lay it out row-major with at most four columns and six rows. Every entry must fit on exactly one 22 px line; never wrap, truncate, or emit ellipsis. Throw a descriptive error when there are more than 24 edges or when any entry, the complete directory, or the normative warning cannot fit within `y = 1610–1800`.

Classify an edge as:

```ts
if (edge.style === 'dotted') return 'evidence';
const columnDelta = to.columnIndex - from.columnIndex;
if (
  edge.style === 'dashed' &&
  (from.bandIndex !== to.bandIndex || columnDelta !== 1)
) return 'async';
if (from.bandIndex !== to.bandIndex) return 'handoff';
if (to.columnIndex < from.columnIndex) return 'return';
if (columnDelta > 1) return 'jump';
if (to.columnIndex === from.columnIndex) return 'same-column-rail';
return 'forward-lane';
```

Allocate all edge codes deterministically in stable source-spec order, including the local `L*` sequence and `S*` fallback, and use the same code in marker metadata and the footer directory. Throw descriptive errors for more than five semantic columns, a band with more than three columns, a column outside one to four nodes, more than 24 edges, more than five local paths in one gutter, detail/footer overflow, or a column whose calculated nodes do not fit the band.

- [x] **Step 6: Run tests and commit**

Run the Task 3 test and full visual unit suite. Expected: PASS.

```bash
git add scripts/notion-srs-visuals/types.ts \
  scripts/notion-srs-visuals/diagram-layout.ts \
  scripts/notion-srs-visuals/diagram-layout.test.ts
git commit -m "feat(docs): add portrait SRS diagram layout"
```

### Task 4: Add geometry collision and shared-segment auditing

**Files:**
- Create: `scripts/notion-srs-visuals/geometry-audit.ts`
- Create: `scripts/notion-srs-visuals/geometry-audit.test.ts`
- Modify: `scripts/notion-srs-visuals/diagram-layout.ts`

**Interfaces:**
- Consumes: `TDiagramLayout`.
- Produces: `auditDiagramGeometry(layout): string[]` used by tests, generation and final validation.

- [x] **Step 1: Write failing collision tests**

```ts
test('should report every node, label and segment collision', () => {
  const errors = auditDiagramGeometry(invalidLayout);
  assert.ok(errors.some((error) => error.includes('node overlap')));
  assert.ok(errors.some((error) => error.includes('label overlaps node')));
  assert.ok(errors.some((error) => error.includes('label overlap')));
  assert.ok(errors.some((error) => error.includes('path crosses node')));
  assert.ok(errors.some((error) => error.includes('shared segment')));
});

test('should accept all twenty-eight production layouts', () => {
  for (const spec of ALL_SPECS) {
    assert.deepEqual(auditDiagramGeometry(layoutDiagram(spec)), [], spec.key);
  }
});
```

- [x] **Step 2: Run tests and verify RED**

Run: `mise exec -- node --test scripts/notion-srs-visuals/geometry-audit.test.ts`

Expected: FAIL because `auditDiagramGeometry` does not exist.

- [x] **Step 3: Implement exact geometry rules**

Implement strict rectangle intersection, axis-aligned segment intersection, shared-segment normalization, canvas bounds, and paired-reference validation. Audit header/column/node text rectangles, badges, local code markers, reference chips, footer directory cells/text, and node rectangles. Physical paths and all markers must remain above the footer (`y < 1610`); every directory cell/text rectangle must remain inside `1610–1800`. Text/badge content inside its owning node is exempt only from intersection with that owner; source/target anchor contact is exempt only for the first/last segment of its own edge.

Validate the one-to-one semantic mapping: each edge has one unique stable code, every local code marker belongs to its path/rail, every paired marker endpoint belongs to the declared source/target node, and every edge has exactly one directory entry with the identical code and full label. Reject more than four directory columns, more than six rows, any overlap with non-owner content, any truncation/ellipsis, or any directory text that exceeds its cell.

Return all errors together with the diagram key and involved IDs; do not stop at the first collision.

- [x] **Step 4: Adjust lane allocation until production layouts audit cleanly**

Only modify deterministic lane/rail offsets in `diagram-layout.ts`. Do not remove semantic edges or weaken geometry checks. If a diagram cannot fit, shorten its Vietnamese prose without deleting the requirement.

- [x] **Step 5: Run tests and commit**

Run Task 4 tests, Task 3 tests, Biome and `git diff --check`. Expected: PASS.

```bash
git add scripts/notion-srs-visuals/geometry-audit.ts \
  scripts/notion-srs-visuals/geometry-audit.test.ts \
  scripts/notion-srs-visuals/diagram-layout.ts
git commit -m "test(docs): enforce SRS diagram geometry"
```

### Task 5: Render the portrait Vietnamese SVGs

**Files:**
- Modify: `scripts/notion-srs-visuals/svg-renderer.ts`
- Modify: `scripts/notion-srs-visuals/svg-renderer.test.ts`

**Interfaces:**
- Consumes: `layoutDiagram`, `auditDiagramGeometry`, and Vietnamese specs.
- Produces: `renderDiagram(spec): string` with `1400 × 1800` semantic SVG.

- [x] **Step 1: Replace renderer tests with portrait contracts**

Assert:

```ts
assert.match(svg, /viewBox="0 0 1400 1800"/);
assert.match(svg, /data-band-index="0"/);
assert.match(svg, /data-band-index="1"/);
assert.match(svg, /font-size="46"/);
assert.match(svg, /font-size="24"/);
assert.match(svg, /data-path-kind="forward-lane"/);
assert.match(svg, /data-edge-code="L1"/);
assert.match(svg, /data-reference-kind="handoff"/);
assert.match(svg, /data-edge-directory-code="L1"/);
assert.match(svg, />Luồng chính \/ điều hướng</);
assert.match(svg, />Audit \/ bằng chứng</);
assert.doesNotMatch(svg, /Visual aid|normative text|request \/ navigation/i);
assert.doesNotMatch(svg, /…/);
```

Keep the existing XML escaping and unsafe SVG assertions.

- [x] **Step 2: Run renderer tests and verify RED**

Run: `mise exec -- node --test scripts/notion-srs-visuals/svg-renderer.test.ts`

Expected: FAIL on old viewBox, English legend and missing band/reference metadata.

- [x] **Step 3: Render layout metadata without recomputing geometry**

`renderDiagram` must:

1. call `layoutDiagram(spec)` once;
2. call `auditDiagramGeometry(layout)` and throw with all errors when non-empty;
3. render header, two band backgrounds, column headings, dynamic node rectangles, local paths with `L*` markers, code-only paired reference chips inside owner nodes, and the full Vietnamese footer edge directory;
4. preserve `<title>`, `<desc>`, `role="img"`, and XML safety;
5. render paths before nodes, then render node text, code-only markers/references, and footer directory content from their allocated metadata.

Use the typography values from `layout.typography`; do not hardcode a second font scale in the renderer.

- [x] **Step 4: Run tests and commit**

Run renderer, layout, geometry and all spec tests. Expected: PASS.

```bash
git add scripts/notion-srs-visuals/svg-renderer.ts \
  scripts/notion-srs-visuals/svg-renderer.test.ts
git commit -m "feat(docs): render readable Vietnamese SRS diagrams"
```

### Task 6: Regenerate, validate and visually review all assets

**Files:**
- Modify: `scripts/notion-srs-visuals/generate.ts`
- Modify: `scripts/notion-srs-visuals/generate.test.ts`
- Modify: `scripts/notion-srs-visuals/validate.ts`
- Regenerate: `docs/superpowers/assets/notion-srs-visuals/*.svg`
- Regenerate: `docs/superpowers/assets/notion-srs-visuals/contact-sheet.html`

**Interfaces:**
- Consumes: Vietnamese manifest/specs and portrait renderer.
- Produces: deterministic 28-asset replacement set plus 700 px and 1000 px review contact sheets.

- [x] **Step 1: Write failing generation contracts**

Update the old viewBox assertion to `0 0 1400 1800` and add:

```ts
assert.doesNotMatch(svg, /…/);
assert.match(svg, /font-size="24"/);
assert.equal((svg.match(/data-band-index=/g) ?? []).length, 2);
assert.equal((svg.match(/data-edge-directory-code=/g) ?? []).length, spec.edges.length);
assert.deepEqual(auditDiagramGeometry(layoutDiagram(spec)), []);
```

Assert the contact sheet offers CSS review widths of exactly `700px` and `1000px` and retains 28 SVG objects.

- [x] **Step 2: Run generation tests and verify RED**

Run: `mise exec -- node --test scripts/notion-srs-visuals/generate.test.ts`

Expected: FAIL on old viewBox/contact-sheet styling.

- [x] **Step 3: Update generator and validator**

Update semantic title/description, viewBox, minimum typography, two-band metadata, Vietnamese-copy audit and geometry audit checks. Validate that every semantic edge has one stable code, code-only marker ownership is correct, and the footer contains exactly one lossless `{code} — {edge.label}` entry per edge in no more than four columns × six rows. Fail on overflow, truncation, or ellipsis. Keep size `< 200 KiB`, deterministic bytes, code-range validation, no external resources, no unsafe SVG, and no placeholders.

- [x] **Step 4: Regenerate and run automated validation**

```bash
mise exec -- node scripts/notion-srs-visuals/generate.ts
mise exec -- node --test scripts/notion-srs-visuals/*.test.ts
mise exec -- node scripts/notion-srs-visuals/validate.ts
xmllint --noout docs/superpowers/assets/notion-srs-visuals/*.svg
pnpm exec biome check scripts/notion-srs-visuals
git diff --check
```

Expected: all tests PASS; generator reports 28; validator reports `28/28 valid`.

- [x] **Step 5: Review at Notion-equivalent widths**

Rasterize every SVG at 700 px and 1000 px width with `rsvg-convert`, build two 4-column contact sheets using ImageMagick, and inspect all 28 diagrams. Reject any clipped Vietnamese text, unreadable code marker, wrong marker-to-owner association, overlapping chip/label, confusing reference pair, incomplete footer directory, directory entry truncation/ellipsis, or remaining English explanatory sentence.

- [x] **Step 6: Commit deterministic assets**

```bash
git add scripts/notion-srs-visuals/generate.ts \
  scripts/notion-srs-visuals/generate.test.ts \
  scripts/notion-srs-visuals/validate.ts \
  docs/superpowers/assets/notion-srs-visuals
git commit -m "docs: regenerate Vietnamese affiliate SRS diagrams"
```

### Task 7: Replace the 28 Notion visual blocks one-for-one

**Files:**
- Read: `scripts/notion-srs-visuals/manifest.ts`
- Read: `docs/superpowers/assets/notion-srs-visuals/*.svg`
- Modify externally: 26 child pages under the SRS master

**Interfaces:**
- Consumes: validated SVG content, Vietnamese/legacy target copy, current Notion v0.5 pages.
- Produces: 28 Vietnamese inline image blocks with unchanged per-page image counts.

- [x] **Step 1: Preflight all pages without mutation**

Fetch all 26 pages and assert per target:

- exactly one legacy heading, alt, caption and filename;
- exactly one image block in Page 2/Page 3 and two in Page 1/Page 4;
- exactly one `Phiên bản áp dụng: 0.5` marker;
- the insertion anchor still exists once;
- the Vietnamese heading/caption is not already present.

Also assert 59 MH headings, 59 component contracts and 470 component rows.

- [x] **Step 2: Replace sequentially**

For each target:

1. fetch the page;
2. extract the exact old visual block from `## Sơ đồ — {legacy.title}` up to, but not including, `insertBefore`;
3. upload the regenerated SVG with `image/svg+xml`;
4. replace the attachment alt with `target.alt` in the returned markdown source;
5. call Notion `update_content` with `properties: {}` and exact old/new block strings;
6. preserve `[Trang đối ứng](relatedPageUrl)` for Page 2/Page 3;
7. fetch immediately and verify the old copy is absent, new copy occurs once, filename occurs once, image count is unchanged, version is still `0.5`, and anchor still occurs once.

Never upload the next target until the current replacement passes read-back.

- [x] **Step 3: Audit all 27 pages**

Fetch master plus 26 children and assert:

- 28 replaced diagrams and 29 total visual blocks;
- Page 1/Page 4 have two images; every Page 2/Page 3 has one;
- 28 Vietnamese headings/alts/captions occur once each;
- zero legacy English headings/alts/captions remain;
- no duplicate filename, image block, heading or caption;
- 26 child pages, 59 MH headings, 59 component contracts and 470 rows remain;
- every page and master still reports version `0.5`.

- [x] **Step 4: Update the master 0.5 changelog row**

Use targeted replacement to change the existing 0.5 description to:

```text
Bổ sung và hiệu chỉnh 28 SVG kỹ thuật: Việt hóa toàn bộ nội dung đọc hiểu, tái bố cục khổ dọc hai tầng, tăng cỡ chữ và loại bỏ đường nối chồng chéo; giữ nguyên đường cơ sở chức năng và phiên bản 0.5 của 26 trang con.
```

Fetch again and verify one updated row, current version `0.5`, one master infographic and 26 child pages.

**Execution evidence (18/07/2026):** the initial 26-page preflight passed with
28 legacy image blocks and 26 version markers. Notion `update_content` could not
match an image block because `fetch` exposes a transient signed asset URL rather
than the stored attachment source; the rejected probe made no mutation. The
rollout therefore fetched each page, uploaded only its validated target SVGs,
replaced only the target visual block(s) in the fetched content, used
`replace_content`, and immediately compared the read-back page with the intended
page after normalizing only the signed image URL. The final 27-page audit passed:
28 replaced diagrams, 29 total visual blocks, zero legacy copy, 26 child version
markers, 59 MH headings, 59 component contracts and 470 component rows. The
master still has one infographic, 26 children and current version `0.5`.

### Task 8: Final audit and execution tracking

**Files:**
- Modify: `docs/superpowers/plans/2026-07-18-notion-srs-vietnamese-legibility-redesign.md`

**Interfaces:**
- Consumes: completed local assets and Notion replacements.
- Produces: evidence-backed handoff with unrelated failures explicitly separated.

- [x] **Step 1: Run focused visual gates**

```bash
mise exec -- node --test scripts/notion-srs-visuals/*.test.ts
mise exec -- node scripts/notion-srs-visuals/validate.ts
xmllint --noout docs/superpowers/assets/notion-srs-visuals/*.svg
```

Expected: all PASS and `28/28 valid`.

- [x] **Step 2: Run repository gates**

```bash
mise typecheck
mise check:ci
mise lint
mise test
```

Record the existing `trading-rpc` file-parallel teardown timeout separately if it reproduces. Do not edit that unrelated service/test in this task. `mise build` remains unnecessary because no app/build-relevant source changes.

- [x] **Step 3: Mark completed checkboxes and commit tracking**

```bash
git add docs/superpowers/plans/2026-07-18-notion-srs-vietnamese-legibility-redesign.md
git commit -m "docs: complete Vietnamese SRS diagram rollout"
```

- [x] **Step 4: Report completion**

Report the master Notion link, 28/29 visual counts, version `0.5`, localization/geometry results, preserved 59/59/470 content counts, local/repository gate results, commit IDs, and confirmation that unrelated dirty-worktree changes were preserved.

**Final gate evidence (18/07/2026):** focused visual tests passed `95/95`,
validation reported `28/28 valid`, and `xmllint` accepted every SVG. Repository
`mise typecheck` and `mise lint` passed. `mise check:ci` retained one unrelated
pre-existing formatting failure in
`apps/dapp/src/_pages/home/api/get-markets.api.ts`; the task-owned contact-sheet
a11y finding was fixed with a semantic `fieldset`/`legend` and its targeted
Biome check passed. `mise test` reproduced the documented unrelated
`services/trading-rpc/src/adapters/http.adapter.test.ts` teardown timeout in the
oversized-message and rate-limit cases (53/55 tests passed in that workspace;
other completed workspaces passed). `mise build` was not required because no
application or build-relevant source changed.
