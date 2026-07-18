# Notion SRS UI Wireframes & Mockups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 59 implementation-ready desktop wireframes and 12 Benadep high-fidelity desktop mockups as sharp 4K PNGs, place all 71 images in the 12 Notion UI SRS pages, and prove that the existing 59/59/470 normative content remains unchanged.

**Architecture:** Normalize the current Notion MH/component tables into a checked-in typed contract, lay out every screen through deterministic recipes, render an SVG scene with embedded Plus Jakarta Sans, and rasterize locally to RGB PNG through `rsvg-convert`. Keep wireframe and high-fidelity renderers separate but feed both from the same screen contract. Use authenticated Notion local-file upload for PNGs, then read back with Notion fetch and audit exact counts/content.

**Tech Stack:** Node.js 22 native erasable TypeScript, Node test runner, deterministic SVG scene generation, pinned Plus Jakarta Sans variable TTF under OFL-1.1, `rsvg-convert`, ImageMagick, authenticated Notion browser/file upload plus Notion fetch/update tools.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-18-notion-srs-ui-wireframes-mockups-design.md`.
- Read-only product source: `/Users/truongdn/Desktop/benadep`; do not edit it in this work.
- Preserve the 12 existing Page 3 navigation diagrams and all existing SRS content.
- Produce exactly 59 wireframes (`MH-001…MH-059`) and 12 high-fidelity mockups, for 71 new files total.
- Every scene uses a `1920×1440` logical desktop canvas; every published file is an opaque RGB PNG at `3840×2880`.
- All visible UI copy, annotations, alt text and captions are Vietnamese; codes, API paths, enum literals, currency and proper nouns may remain technical English.
- Use Benadep Luxury Blush tokens and Plus Jakarta Sans; use only neutral placeholder media.
- Do not copy Shopee pixel layout, icons, colors, logo, copy or trade dress.
- Component contract remains normative; every visual must carry the visual-aid warning.
- Preserve 59 MH headings, 59 component contracts, 470 component rows, related-page links and Notion version `0.5`.
- After rollout, Page 3 contains exactly 83 images: 12 old navigation + 12 mockup + 59 wireframe. The complete SRS tree contains exactly 100 visual blocks: 29 existing + 71 new.
- No PNG may exceed 5 MiB; fail generation instead of silently reducing resolution or changing to JPEG.
- Do not add runtime application dependencies or touch build-relevant application source.
- Use `apply_patch` for text/source edits; generated PNGs and downloaded licensed font binaries are the allowed mechanical-generation exceptions.
- Preserve all unrelated dirty-worktree changes and use scoped commits only.

---

### Task 1: Freeze Page 3 targets and define the screen-contract schema

**Files:**
- Create: `scripts/notion-srs-wireframes/types.ts`
- Create: `scripts/notion-srs-wireframes/manifest.ts`
- Create: `scripts/notion-srs-wireframes/manifest.test.ts`
- Read: `scripts/notion-srs-visuals/manifest.ts`
- Read: `scripts/notion-srs-visuals/ui-specs.ts`

**Interfaces:**
- Consumes: the twelve existing `kind: 'ui'` targets and MH ranges.
- Produces: `UI_WIREFRAME_PAGES`, `WIREFRAME_TARGETS`, `MOCKUP_TARGETS`, `TScreenContract`, `TScreenComponent`, `TScreenState`, and stable filename/alt/caption contracts.

- [ ] **Step 1: Write the failing manifest tests**

Create tests that require exact Page 3 coverage and stable output metadata:

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOCKUP_TARGETS,
  UI_WIREFRAME_PAGES,
  WIREFRAME_TARGETS,
} from './manifest.ts';

test('should define twelve UI pages and all fifty-nine MH targets', () => {
  assert.equal(UI_WIREFRAME_PAGES.length, 12);
  assert.equal(WIREFRAME_TARGETS.length, 59);
  assert.equal(MOCKUP_TARGETS.length, 12);
  assert.equal(new Set(WIREFRAME_TARGETS.map((item) => item.code)).size, 59);
  assert.deepEqual(
    WIREFRAME_TARGETS.map((item) => item.code),
    Array.from({ length: 59 }, (_, index) =>
      `MH-${String(index + 1).padStart(3, '0')}`,
    ),
  );
});

test('should publish only Vietnamese 4K PNG metadata', () => {
  for (const target of [...WIREFRAME_TARGETS, ...MOCKUP_TARGETS]) {
    assert.match(target.filename, /^[a-z0-9-]+\.png$/);
    assert.match(target.alt, /Wireframe desktop|Mockup high-fidelity/);
    assert.match(target.caption, /nguồn quyết định/);
  }
});
```

- [ ] **Step 2: Run the manifest test and verify RED**

Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/manifest.test.ts
```

Expected: FAIL because the manifest module does not exist.

- [ ] **Step 3: Define the typed public contract**

Implement these discriminated types in `types.ts`:

```typescript
export type TSurface = 'storefront' | 'vendor' | 'admin';
export type TLayoutRecipe =
  | 'dashboard'
  | 'form'
  | 'list'
  | 'detail'
  | 'composer'
  | 'viewer'
  | 'evidence'
  | 'reconciliation';

export type TScreenState =
  | 'loading'
  | 'empty'
  | 'ready'
  | 'editing'
  | 'submitting'
  | 'success'
  | 'validation-error'
  | 'query-error'
  | 'denied'
  | 'disabled'
  | 'destructive-confirmation'
  | 'stale'
  | 'rate-limited'
  | 'dependency-unavailable'
  | 'offline'
  | 'held'
  | 'failed'
  | 'remediation'
  | 'rejected'
  | 'suspended'
  | 'expired'
  | 'removed'
  | 'reconnecting'
  | 'ended'
  | 'moderation'
  | 'appeal';

export type TScreenComponent = {
  readonly id: string;
  readonly annotationCode: string;
  readonly label: string;
  readonly type: string;
  readonly requirement: string;
  readonly validation: string;
  readonly binding: string;
  readonly states: readonly TScreenState[];
  readonly region: 'header' | 'primary' | 'secondary' | 'aside' | 'footer';
};

export type TScreenContract = {
  readonly code: `MH-${string}`;
  readonly pageKey: `3-${string}-ui`;
  readonly title: string;
  readonly surface: TSurface;
  readonly actor: string;
  readonly route: string;
  readonly layoutRecipe: TLayoutRecipe;
  readonly primaryAction: string;
  readonly safeExit: string;
  readonly states: readonly TScreenState[];
  readonly components: readonly TScreenComponent[];
};
```

- [ ] **Step 4: Implement the 12-page and 71-target manifest**

Build Page 3 targets by filtering the existing SRS visual manifest; hard-fail if the source has anything other than 12 UI pages. Encode the approved mockup representatives exactly:

```typescript
export const MOCKUP_SCREEN_CODES = [
  'MH-001', 'MH-006', 'MH-012', 'MH-018',
  'MH-022', 'MH-030', 'MH-033', 'MH-036',
  'MH-042', 'MH-046', 'MH-052', 'MH-058',
] as const;
```

Derive filenames from one slug function only:

- wireframe: `{mh-code-lower}-{screen-slug}-wireframe.png`;
- mockup: `srs-{page-number-with-dashes}-{screen-slug}-mockup.png`.

Assert 71 unique filenames and disallow caller-supplied filename, alt or caption
overrides so metadata cannot drift from the screen contract.

Expected page image totals after rollout are `[7, 8, 8, 6, 7, 7, 6, 7, 7, 7, 7, 6]` for pages `3.01…3.12`.

- [ ] **Step 5: Run tests and commit the schema checkpoint**

Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/manifest.test.ts
git diff --check
```

Expected: PASS.

Commit:

```bash
git add scripts/notion-srs-wireframes/types.ts \
  scripts/notion-srs-wireframes/manifest.ts \
  scripts/notion-srs-wireframes/manifest.test.ts
git commit -m "feat(docs): define SRS wireframe target contract"
```

### Task 2: Capture and normalize the 59/470 Notion contracts

**Files:**
- Create: `scripts/notion-srs-wireframes/screen-contracts.ts`
- Create: `scripts/notion-srs-wireframes/screen-contracts.test.ts`
- Create: `scripts/notion-srs-wireframes/localization-policy.ts`
- Create: `scripts/notion-srs-wireframes/localization-policy.test.ts`
- Read externally: twelve Notion pages from `UI_WIREFRAME_PAGES`

**Interfaces:**
- Consumes: exact current Notion MH overview tables, component tables, interaction tables and required-state lists.
- Produces: `SCREEN_CONTRACTS: readonly TScreenContract[]` and `auditVietnameseScreenContracts(): string[]`.

- [ ] **Step 1: Preflight all twelve Notion pages without mutation**

Fetch each page and assert:

- exactly one `Phiên bản áp dụng: 0.5`;
- exactly one existing navigation image;
- exact expected MH range for the page;
- one `### Component contract (implementation-ready)` per MH;
- exactly 470 component data rows across all pages;
- exactly one related-page link per page;
- no wireframe/mockup target filename already present.

Store only structured extraction results in the implementation session; do not commit raw Notion signed URLs.

- [ ] **Step 2: Write the failing coverage and localization tests**

```typescript
test('should preserve all Notion screen and component contracts', () => {
  assert.equal(SCREEN_CONTRACTS.length, 59);
  assert.equal(
    SCREEN_CONTRACTS.reduce((sum, screen) => sum + screen.components.length, 0),
    470,
  );
  assert.deepEqual(
    SCREEN_CONTRACTS.map((screen) => screen.code),
    WIREFRAME_TARGETS.map((target) => target.code),
  );
});

test('should own every component ID inside one screen', () => {
  for (const screen of SCREEN_CONTRACTS) {
    assert.equal(
      new Set(screen.components.map((component) => component.id)).size,
      screen.components.length,
      screen.code,
    );
    assert.deepEqual(
      screen.components.map((component) => component.annotationCode),
      screen.components.map((component) => component.id),
      screen.code,
    );
    for (const component of screen.components) {
      assert.equal(
        component.states.every((state) => screen.states.includes(state)),
        true,
        `${screen.code}/${component.id}`,
      );
    }
  }
});

test('should expose Vietnamese visible copy without hiding technical values', () => {
  assert.deepEqual(auditVietnameseScreenContracts(SCREEN_CONTRACTS), []);
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
mise exec -- node --test \
  scripts/notion-srs-wireframes/screen-contracts.test.ts \
  scripts/notion-srs-wireframes/localization-policy.test.ts
```

Expected: FAIL because the 59 contracts and policy do not exist.

- [ ] **Step 4: Normalize all 59 screens**

For every MH section, capture:

- title, actor, logical route and primary action from the overview table;
- all five component columns;
- stable annotation code and component-applicable states;
- required states and recovery behavior;
- surface and layout recipe;
- semantic region for each component.

Translate visible labels/types/requirements/annotations to Vietnamese. Preserve code, enum literal, route, API name, binding path, FTC, RBAC, MCN, PPS, PPP, LIVE, Video, USD and other approved proper/technical terms. Translate business sentences such as `Program summary`, `Always visible`, `Computed · Read-only`, `Check eligibility` and their equivalents.

For MH-001, the normalized first components must begin:

```typescript
{
  id: 'D01',
  annotationCode: 'D01',
  label: 'Tổng quan chương trình',
  type: 'Thẻ nổi bật + Cảnh báo',
  requirement: 'Luôn hiển thị',
  validation: 'Phiên bản chương trình, quyền lợi và nghĩa vụ; không có dữ liệu chỉnh sửa.',
  binding: '`program.*`; hiển thị thông báo điều kiện và liên kết FTC/thuế.',
  states: ['loading', 'ready', 'dependency-unavailable'],
  region: 'primary',
}
```

The checked-in contract is the normalized visual snapshot; it must not contain transient Notion attachment URLs.

- [ ] **Step 5: Implement the Vietnamese-copy audit**

Audit all visible fields while allowing code-like tokens. Reject explanatory English phrases and unfinished placeholder copy. Reuse the approved intent of `scripts/notion-srs-visuals/localization-policy.ts`, but keep this policy independent because screen contracts have different fields.

- [ ] **Step 6: Run coverage/localization tests and commit**

Run:

```bash
mise exec -- node --test \
  scripts/notion-srs-wireframes/screen-contracts.test.ts \
  scripts/notion-srs-wireframes/localization-policy.test.ts
git diff --check
```

Expected: PASS with `59` screens and `470` component rows.

Commit:

```bash
git add scripts/notion-srs-wireframes/screen-contracts.ts \
  scripts/notion-srs-wireframes/screen-contracts.test.ts \
  scripts/notion-srs-wireframes/localization-policy.ts \
  scripts/notion-srs-wireframes/localization-policy.test.ts
git commit -m "docs: normalize affiliate UI screen contracts"
```

### Task 3: Build deterministic screen layout and geometry audit

**Files:**
- Modify: `scripts/notion-srs-wireframes/types.ts`
- Create: `scripts/notion-srs-wireframes/layout-recipes.ts`
- Create: `scripts/notion-srs-wireframes/layout-recipes.test.ts`
- Create: `scripts/notion-srs-wireframes/geometry-audit.ts`
- Create: `scripts/notion-srs-wireframes/geometry-audit.test.ts`

**Interfaces:**
- Consumes: `TScreenContract`.
- Produces: `layoutScreen(contract, fidelity): TScreenLayout` and `auditScreenGeometry(layout): string[]`.

- [ ] **Step 1: Write failing recipe tests**

Require all eight recipe types, 1920×1440 bounds, a stable four-zone wireframe layout, one primary action and exact component ownership:

```typescript
test('should layout all fifty-nine screen contracts without losing components', () => {
  for (const screen of SCREEN_CONTRACTS) {
    const layout = layoutScreen(screen, 'wireframe');
    assert.equal(layout.width, 1920);
    assert.equal(layout.height, 1440);
    assert.equal(
      new Set(layout.componentPlacements.map((item) => item.componentId)).size,
      screen.components.length,
      screen.code,
    );
    assert.deepEqual(auditScreenGeometry(layout), [], screen.code);
  }
});
```

Also require the 12 representative layouts to fit without an annotation directory in high-fidelity mode.

- [ ] **Step 2: Run layout tests and verify RED**

Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/layout-recipes.test.ts
```

Expected: FAIL because layout functions do not exist.

- [ ] **Step 3: Implement the fixed canvas zones**

Add `TScreenLayout`, `TComponentPlacement`, `TRect` and typography/placeholder
primitive types to `types.ts`. `TScreenLayout` must expose `width`, `height`,
`fidelity`, `componentPlacements`, `primaryActionPlacement`, `safeExitPlacement`,
`statePlacements` and scene primitives so both renderers consume one audited
geometry contract.

Use these exact logical regions in `layout-recipes.ts`:

```typescript
export const SCREEN_CANVAS = { width: 1920, height: 1440 } as const;
export const WIREFRAME_ZONES = {
  chrome: { x: 32, y: 24, width: 1856, height: 88 },
  primary: { x: 32, y: 128, width: 1856, height: 900 },
  states: { x: 32, y: 1044, width: 1856, height: 140 },
  directory: { x: 32, y: 1200, width: 1856, height: 208 },
} as const;
```

Implement eight recipe functions. Each function consumes component order/region/type and returns deterministic rectangles, typography roles and placeholder primitives. It must never sort components by translated label; retain contract order.

- [ ] **Step 4: Implement collision and typography audits**

Detect:

- rectangle overlap outside declared containment;
- text bounds leaving its owner;
- component/annotation duplication or loss;
- body text under 16 logical px and annotation under 14 logical px;
- interactive targets under 44 logical px;
- missing primary action or safe exit;
- state strip overflow;
- directory entries outside four columns;
- any bounds outside 1920×1440.

- [ ] **Step 5: Run all layout/geometry tests and commit**

Run:

```bash
mise exec -- node --test \
  scripts/notion-srs-wireframes/layout-recipes.test.ts \
  scripts/notion-srs-wireframes/geometry-audit.test.ts
```

Expected: PASS for all 59 wireframes and 12 representative layouts.

Commit:

```bash
git add scripts/notion-srs-wireframes/layout-recipes.ts \
  scripts/notion-srs-wireframes/layout-recipes.test.ts \
  scripts/notion-srs-wireframes/geometry-audit.ts \
  scripts/notion-srs-wireframes/geometry-audit.test.ts
git commit -m "feat(docs): add deterministic SRS screen layouts"
```

### Task 4: Render all 59 annotated wireframe scenes

**Files:**
- Create: `scripts/notion-srs-wireframes/scene-primitives.ts`
- Create: `scripts/notion-srs-wireframes/wireframe-renderer.ts`
- Create: `scripts/notion-srs-wireframes/wireframe-renderer.test.ts`

**Interfaces:**
- Consumes: audited `TScreenLayout` in wireframe fidelity.
- Produces: `renderWireframe(screen, layout, fontData): string`, a safe SVG master scene.

- [ ] **Step 1: Write failing semantic SVG tests**

Require:

- exact `viewBox="0 0 1920 1440"`;
- root title/description containing code/title/actor;
- one `data-component-id` per component row;
- one annotation directory entry per component;
- Vietnamese legend/state copy;
- `data-font-family="Plus Jakarta Sans"`;
- no external URL, script, foreignObject, event handler or Shopee branding.

- [ ] **Step 2: Run renderer tests and verify RED**

Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/wireframe-renderer.test.ts
```

Expected: FAIL because renderer modules do not exist.

- [ ] **Step 3: Implement reusable scene primitives**

Provide deterministic primitives for:

- app chrome/sidebar/topbar;
- heading, body, label, helper and status text;
- input/select/textarea/checkbox/switch;
- primary/secondary/destructive button;
- card/alert/badge/checklist;
- table/list/filter/pagination;
- modal/sheet/tabs/accordion;
- chart/evidence/timeline/ledger rows;
- neutral image/avatar/video/live placeholders;
- component annotation markers and directory entries.

Every primitive receives explicit coordinates and escapes XML. Do not use random IDs or timestamps.

- [ ] **Step 4: Implement wireframe composition**

Render paths/backgrounds before components, then markers/state strip/directory. Use white/gray surfaces with Dusty Rose only for CTA, focus, selection and annotation ownership. Add the exact footer warning:

```text
Visual aid; component contract và nội dung SRS chuẩn tắc vẫn là nguồn quyết định.
```

- [ ] **Step 5: Verify 59 SVG scenes and commit**

Run:

```bash
mise exec -- node --test \
  scripts/notion-srs-wireframes/wireframe-renderer.test.ts \
  scripts/notion-srs-wireframes/layout-recipes.test.ts \
  scripts/notion-srs-wireframes/geometry-audit.test.ts
```

Expected: PASS.

Commit:

```bash
git add scripts/notion-srs-wireframes/scene-primitives.ts \
  scripts/notion-srs-wireframes/wireframe-renderer.ts \
  scripts/notion-srs-wireframes/wireframe-renderer.test.ts
git commit -m "feat(docs): render affiliate UI wireframe scenes"
```

### Task 5: Render the 12 Benadep high-fidelity scenes

**Files:**
- Create: `scripts/notion-srs-wireframes/benadep-theme.ts`
- Create: `scripts/notion-srs-wireframes/accessibility-audit.ts`
- Create: `scripts/notion-srs-wireframes/accessibility-audit.test.ts`
- Create: `scripts/notion-srs-wireframes/mockup-renderer.ts`
- Create: `scripts/notion-srs-wireframes/mockup-renderer.test.ts`
- Modify: `scripts/notion-srs-wireframes/wireframe-renderer.test.ts`
- Read: `/Users/truongdn/Desktop/benadep/packages/design-system/src/tokens/*.css`
- Read: `/Users/truongdn/Desktop/benadep/apps/{storefront,vendor-portal}/src/components/ui/*`
- Read: `/Users/truongdn/Desktop/benadep/apps/backend/src/admin/branding/admin-theme.css`

**Interfaces:**
- Consumes: the same representative `TScreenContract` and audited high-fidelity layout.
- Produces: `renderMockup(screen, layout, fontData): string` for exactly 12 representative screens.

- [ ] **Step 1: Write failing Benadep-theme and representative-screen tests**

Before writing visual implementation, load the `frontend-design` and
`ui-ux-pro-max` skills and constrain their output to the already approved design
spec; do not reopen product-scope decisions.

Require exact approved tokens and selected MH codes:

```typescript
assert.deepEqual(BENADEP_THEME, {
  primary: '#E9486A',
  primaryLight: '#F67993',
  deepPlum: '#A21C38',
  page: '#FFF9F8',
  card: '#FFFDFB',
  radius: 10,
  spacingUnit: 8,
});
assert.deepEqual(
  MOCKUP_TARGETS.map((target) => target.screenCode),
  MOCKUP_SCREEN_CODES,
);
```

Test that each mockup contains every component ID of its source contract in SVG metadata and contains no external/image href.

Add accessibility tests for every wireframe and mockup scene. Parse each text,
control, focus and status primitive; require WCAG 2.2 AA contrast, visible text
for non-decorative status colors, body/annotation minimum sizes, and interactive
targets of at least 44×44 logical px. The audit must report the MH code,
component ID and failing foreground/background pair.

- [ ] **Step 2: Run mockup tests and verify RED**

Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/mockup-renderer.test.ts
```

Expected: FAIL because the theme/renderer does not exist.

- [ ] **Step 3: Implement the Benadep theme adapter**

Copy semantic values, not application CSS. Record source path and token name alongside each value so later source drift is reviewable. Use Plus Jakarta Sans, 8px spacing, 10px radius, blush shadows, AA focus ring and neutral placeholders.

Implement `auditSceneAccessibility(scene): string[]` independently from the
renderers. It must derive contrast from final resolved hex/RGB values, including
disabled, placeholder, error, success and focus states; renderer-owned `passed`
flags are not accepted as evidence.

- [ ] **Step 4: Implement 12 screen-specific high-fidelity compositions**

Create explicit composition functions for:

- MH-001 Affiliate Center & Eligibility;
- MH-006 Affiliate Dashboard;
- MH-012 Trình tạo affiliate link;
- MH-018 Chi tiết quyết định attribution;
- MH-022 Feed Video commerce;
- MH-030 Phòng LIVE Viewer;
- MH-033 Cấu hình tỷ lệ hoa hồng;
- MH-036 Hộp thư cộng tác;
- MH-042 Quản lý MCN roster;
- MH-046 Ví Creator;
- MH-052 Hàng đợi Risk;
- MH-058 Tình trạng product feed.

Mockups are screenshot-like app screens: no annotation directory, but retain component IDs in SVG metadata for traceability. Use only neutral labeled shapes for product/avatar/banner/video imagery.

- [ ] **Step 5: Run mockup/geometry tests and commit**

Run:

```bash
mise exec -- node --test \
  scripts/notion-srs-wireframes/accessibility-audit.test.ts \
  scripts/notion-srs-wireframes/mockup-renderer.test.ts \
  scripts/notion-srs-wireframes/wireframe-renderer.test.ts \
  scripts/notion-srs-wireframes/geometry-audit.test.ts
```

Expected: PASS for 12/12 mockups.

Commit:

```bash
git add scripts/notion-srs-wireframes/benadep-theme.ts \
  scripts/notion-srs-wireframes/accessibility-audit.ts \
  scripts/notion-srs-wireframes/accessibility-audit.test.ts \
  scripts/notion-srs-wireframes/mockup-renderer.ts \
  scripts/notion-srs-wireframes/mockup-renderer.test.ts \
  scripts/notion-srs-wireframes/wireframe-renderer.test.ts
git commit -m "feat(docs): render Benadep affiliate UI mockups"
```

### Task 6: Pin the font and rasterize masters into 4K PNG

**Files:**
- Create mechanically: `scripts/notion-srs-wireframes/fonts/PlusJakartaSans-VariableFont_wght.ttf`
- Create mechanically: `scripts/notion-srs-wireframes/fonts/OFL.txt`
- Create: `scripts/notion-srs-wireframes/font.ts`
- Create: `scripts/notion-srs-wireframes/rasterize.ts`
- Create: `scripts/notion-srs-wireframes/rasterize.test.ts`
- Create: `scripts/notion-srs-wireframes/png-metadata.ts`

**Interfaces:**
- Consumes: safe SVG master scenes and pinned font bytes.
- Produces: `rasterizeSvg(svg, outputPath): Promise<void>` and `readPngMetadata(buffer)`.

- [ ] **Step 1: Write failing font and PNG metadata tests**

Require the pinned Google Fonts commit and hashes:

```typescript
assert.equal(
  PLUS_JAKARTA_SHA256,
  '89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8',
);
assert.equal(
  OFL_SHA256,
  '995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99',
);
```

Require PNG signature, width `3840`, height `2880`, bit depth `8`, RGB color type `2`, opaque output and size below 5 MiB.

- [ ] **Step 2: Run raster tests and verify RED**

Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/rasterize.test.ts
```

Expected: FAIL because font/raster modules and assets do not exist.

- [ ] **Step 3: Download the pinned OFL font and license**

Use these immutable sources:

```text
https://raw.githubusercontent.com/google/fonts/389b770410cc0b7c21c85673bfa2077420fe7f65/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf
https://raw.githubusercontent.com/google/fonts/389b770410cc0b7c21c85673bfa2077420fe7f65/ofl/plusjakartasans/OFL.txt
```

Verify exact SHA-256 values above before accepting either file. Do not use the generated `.next` font cache from the Benadep repo.

- [ ] **Step 4: Implement font embedding and rasterization**

Embed the TTF as a base64 `@font-face` data URL inside each SVG scene. The
implementation invokes `rsvg-convert` with an explicit argument array equivalent
to this concrete test-fixture command:

```bash
rsvg-convert --width 3840 --height 2880 --format png \
  --output /tmp/notion-srs-raster-test/rendered.png \
  /tmp/notion-srs-raster-test/master.svg
```

Then use ImageMagick to strip volatile metadata and force opaque RGB without
changing dimensions, again through an explicit argument array equivalent to:

```bash
magick /tmp/notion-srs-raster-test/rendered.png \
  -alpha remove -alpha off -strip -define png:compression-level=9 \
  PNG24:/tmp/notion-srs-raster-test/normalized.png
```

The implementation uses `execFile`, explicit absolute paths and temporary directories from `mkdtemp`; it does not build shell command strings.

- [ ] **Step 5: Verify deterministic PNG bytes and commit**

Render the same scene twice and require identical SHA-256. Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/rasterize.test.ts
```

Expected: PASS; font family/glyph probe includes `Điều kiện`, `Tỷ lệ`, `Đối soát` without missing-glyph boxes.

Commit:

```bash
git add scripts/notion-srs-wireframes/fonts \
  scripts/notion-srs-wireframes/font.ts \
  scripts/notion-srs-wireframes/rasterize.ts \
  scripts/notion-srs-wireframes/rasterize.test.ts \
  scripts/notion-srs-wireframes/png-metadata.ts
git commit -m "build(docs): add deterministic 4K PNG rasterizer"
```

### Task 7: Generate, validate and visually review all 71 assets

**Files:**
- Create: `scripts/notion-srs-wireframes/generate.ts`
- Create: `scripts/notion-srs-wireframes/generate.test.ts`
- Create: `scripts/notion-srs-wireframes/validate.ts`
- Generate: `docs/superpowers/assets/notion-srs-wireframes/wireframes/*.png`
- Generate: `docs/superpowers/assets/notion-srs-wireframes/mockups/*.png`
- Generate: `docs/superpowers/assets/notion-srs-wireframes/contact-sheet-wireframes.html`
- Generate: `docs/superpowers/assets/notion-srs-wireframes/contact-sheet-mockups.html`

**Interfaces:**
- Consumes: all contracts, layouts, renderers and rasterizer.
- Produces: a deterministic 59+12 asset set and `validateGeneratedAssets(outputDir): Promise<string[]>`.

- [ ] **Step 1: Write failing generation contracts**

Require:

- 59 files under `wireframes/`;
- 12 files under `mockups/`;
- two contact sheets;
- every PNG exactly 3840×2880 RGB8 and below 5 MiB;
- all names/metadata match manifest;
- byte-identical output across two temporary generation runs;
- no intermediate SVG published in the output directory;
- all contract/localization/geometry audits pass before rasterization.

- [ ] **Step 2: Run generation tests and verify RED**

Run:

```bash
mise exec -- node --test scripts/notion-srs-wireframes/generate.test.ts
```

Expected: FAIL because generator/validator do not exist.

- [ ] **Step 3: Implement generator, validator and contact sheets**

Before writing the contact-sheet HTML/CSS/client-side controls, load and apply
the `modern-web-guidance` skill.

The wireframe contact sheet groups cards by Page 3 number and displays MH code/title/recipe/component count. The mockup sheet uses one column at a review width that preserves the 4:3 canvas. Both sheets support fit width and 100% pixel review and use semantic form controls.

- [ ] **Step 4: Generate and run automated gates**

Run:

```bash
mise exec -- node scripts/notion-srs-wireframes/generate.ts
mise exec -- node --test scripts/notion-srs-wireframes/*.test.ts
mise exec -- node scripts/notion-srs-wireframes/validate.ts
pnpm exec biome check scripts/notion-srs-wireframes \
  docs/superpowers/assets/notion-srs-wireframes/*.html
git diff --check
```

Expected: generator reports `59 wireframes + 12 mockups generated`; validator reports `71/71 valid`; all tests pass.

- [ ] **Step 5: Perform full visual review**

Open both contact sheets. Inspect every image at fit width and 100% pixel. Reject and fix:

- unreadable Vietnamese text or missing diacritics;
- fuzzy text/strokes;
- clipping/overlap;
- component marker assigned to the wrong owner;
- missing required/read-only/validation/binding annotation;
- state strip without safe recovery;
- high-fidelity mockup diverging from its source wireframe;
- placeholder resembling a real user/product;
- Shopee brand/trade-dress resemblance.

Additionally inspect individual dense screens: MH-002, MH-006, MH-018, MH-022, MH-029, MH-033, MH-042, MH-046, MH-052 and MH-058.

- [ ] **Step 6: Commit deterministic assets**

```bash
git add scripts/notion-srs-wireframes/generate.ts \
  scripts/notion-srs-wireframes/generate.test.ts \
  scripts/notion-srs-wireframes/validate.ts \
  docs/superpowers/assets/notion-srs-wireframes
git commit -m "docs: generate affiliate UI wireframes and mockups"
```

### Task 8: Upload and insert the 71 PNGs into Notion

**Files:**
- Read: `scripts/notion-srs-wireframes/manifest.ts`
- Read: `docs/superpowers/assets/notion-srs-wireframes/**/*.png`
- Modify externally: the twelve Page 3 Notion pages

**Interfaces:**
- Consumes: validated local PNGs and exact Notion anchors.
- Produces: 71 new Notion image blocks with Vietnamese alt/caption and unchanged normative text.

- [ ] **Step 1: Re-run a mutation preflight**

Fetch all twelve pages immediately before upload. Assert the Task 2 baseline still holds and no target filename/title/alt/caption exists. Save per-page semantic counts and a content fingerprint that ignores only signed attachment URLs.

- [ ] **Step 2: Upload one pilot page through authenticated local-file upload**

Load `notion:notion-knowledge-capture` for the structured Notion mutation and
`agent-browser` only for the authenticated local-file upload path that the
Notion content API cannot perform directly.

Use page 3.01 as the pilot:

- upload `srs-3-01-affiliate-center-eligibility-mockup.png` before `### Quy ước Component Contract`;
- upload the five MH-001…MH-005 wireframes immediately after their unique MH headings;
- set exact manifest alt/caption;
- do not use a public intermediary host.

Fetch page 3.01 immediately and require 7 images, one new mockup, five new wireframes, the original navigation image, version `0.5`, five MH headings/contracts, unchanged component rows and one related-page link.

- [ ] **Step 3: Roll out pages 3.02…3.12 sequentially**

For each page:

1. fetch immediately before mutation;
2. upload the page mockup;
3. upload each page wireframe in MH order;
4. set Vietnamese alt/caption from manifest;
5. fetch immediately after the page;
6. compare semantic fingerprint and expected image count;
7. stop before the next page if any check fails.

Expected image totals: 3.02=8, 3.03=8, 3.04=6, 3.05=7, 3.06=7, 3.07=6, 3.08=7, 3.09=7, 3.10=7, 3.11=7, 3.12=6.

- [ ] **Step 4: Update the master 0.5 changelog with targeted text replacement**

Append this meaning to the existing 0.5 visual-enhancement row without changing the version:

```text
Bổ sung 59 wireframe desktop và 12 mockup high-fidelity PNG 4K cho MH-001…MH-059; giữ nguyên component contract, functional baseline và phiên bản 0.5.
```

Fetch master again and verify one updated changelog row, one master infographic and 26 child pages.

### Task 9: Final Notion audit and repository handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-07-18-notion-srs-ui-wireframes-mockups.md`

**Interfaces:**
- Consumes: local assets, completed Notion rollout and repository state.
- Produces: evidence-backed completion record.

- [ ] **Step 1: Audit the complete Notion tree**

Fetch master plus 26 children and assert:

- 71 new assets occur exactly once;
- 83 image blocks exist across Page 3;
- 100 visual blocks exist across the full SRS tree;
- 12 old Page 3 navigation diagrams remain;
- 12 mockups and 59 wireframes use the exact filename/alt/caption;
- 59 MH headings, 59 component contracts and 470 component rows remain;
- all 12 related-page links remain;
- 26 child pages and current master version `0.5` remain;
- no duplicate/missing image, filename, heading or caption exists.

- [ ] **Step 2: Run focused visual gates**

```bash
mise exec -- node --test scripts/notion-srs-wireframes/*.test.ts
mise exec -- node scripts/notion-srs-wireframes/validate.ts
pnpm exec biome check scripts/notion-srs-wireframes \
  docs/superpowers/assets/notion-srs-wireframes/*.html
git diff --check
```

Expected: all pass and `71/71 valid`.

- [ ] **Step 3: Run repository gates**

```bash
mise typecheck
mise check:ci
mise lint
mise test
```

Record the unrelated pre-existing dapp format error or trading-rpc teardown timeout separately if either reproduces. Do not edit those unrelated files. `mise build` is unnecessary because no application/build-relevant source changes.

- [ ] **Step 4: Mark all plan checkboxes and commit tracking**

```bash
git add docs/superpowers/plans/2026-07-18-notion-srs-ui-wireframes-mockups.md
git commit -m "docs: complete affiliate UI visual rollout"
```

- [ ] **Step 5: Report completion**

Report:

- master Notion link;
- 59/12/71/83/100 visual counts;
- version `0.5` and preserved 59/59/470 counts;
- 4K raster/font/geometry/localization results;
- focused and repository gate results;
- commit IDs;
- confirmation that unrelated worktree changes were preserved.
