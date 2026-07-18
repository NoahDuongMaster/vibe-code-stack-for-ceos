import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { layoutScreen } from './layout-recipes.ts';
import {
  escapeXml,
  renderDirectoryEntry,
  renderText,
} from './scene-primitives.ts';
import { SCREEN_CONTRACTS, SCREEN_STATE_LABELS } from './screen-contracts.ts';
import type { TScreenContract, TScreenLayout } from './types.ts';
import { renderWireframe } from './wireframe-renderer.ts';

const PINNED_FONT_PATH = new URL(
  './fonts/PlusJakartaSans-VariableFont_wght.ttf',
  import.meta.url,
);
const PINNED_OFL_PATH = new URL('./fonts/OFL.txt', import.meta.url);
const PINNED_FONT_BYTES = readFileSync(PINNED_FONT_PATH);
const PINNED_OFL_BYTES = readFileSync(PINNED_OFL_PATH);
const TEST_FONT_DATA = PINNED_FONT_BYTES.toString('base64');
const PINNED_FONT_SHA256 =
  '89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8';
const PINNED_OFL_SHA256 =
  '995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99';
const WARNING =
  'Visual aid; component contract và nội dung SRS chuẩn tắc vẫn là nguồn quyết định.';

const RECIPE_LABELS = {
  dashboard: 'tổng quan',
  form: 'biểu mẫu',
  list: 'danh sách',
  detail: 'chi tiết',
  composer: 'trình soạn nội dung',
  viewer: 'trình xem',
  evidence: 'bằng chứng',
  reconciliation: 'đối soát',
} as const;

const countExactAttribute = (
  svg: string,
  attribute: string,
  value: string,
): number =>
  svg.match(
    new RegExp(
      `${attribute}="${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
      'gu',
    ),
  )?.length ?? 0;

test('should render all fifty-nine audited layouts without component or directory loss', () => {
  assert.equal(SCREEN_CONTRACTS.length, 59);

  for (const screen of SCREEN_CONTRACTS) {
    const layout = layoutScreen(screen, 'wireframe');
    const svg = renderWireframe(screen, layout, TEST_FONT_DATA);

    assert.match(svg, /viewBox="0 0 1920 1440"/u, screen.code);
    assert.match(svg, /width="1920" height="1440"/u, screen.code);
    assert.match(svg, /data-font-family="Plus Jakarta Sans"/u, screen.code);
    assert.equal(svg.includes(escapeXml(screen.code)), true, screen.code);
    assert.equal(
      svg.includes(escapeXml(screen.displayTitle)),
      true,
      screen.code,
    );
    assert.equal(svg.includes(escapeXml(screen.actor)), true, screen.code);
    const rootId = screen.code.toLocaleLowerCase('en-US');
    assert.equal(
      svg.includes(
        `<title id="${rootId}-title">${escapeXml(`${screen.code} — ${screen.displayTitle}`)}</title>`,
      ),
      true,
      `${screen.code}: root title`,
    );
    assert.equal(
      svg.includes(
        `<desc id="${rootId}-description">${escapeXml(`Bản phác thảo giao diện desktop cho ${screen.displayTitle}. Vai trò: ${screen.actor}. Bố cục: ${RECIPE_LABELS[screen.layoutRecipe]}.`)}</desc>`,
      ),
      true,
      `${screen.code}: root description`,
    );
    assert.equal(
      countExactAttribute(svg, 'data-component-id', ''),
      0,
      `${screen.code}: empty component owner`,
    );

    for (const component of screen.components) {
      assert.equal(
        countExactAttribute(svg, 'data-component-id', component.id),
        1,
        `${screen.code}/${component.id}: visual owner`,
      );
      assert.equal(
        countExactAttribute(svg, 'data-directory-component-id', component.id),
        1,
        `${screen.code}/${component.id}: directory owner`,
      );
      assert.equal(
        countExactAttribute(
          svg,
          'data-annotation-marker',
          component.annotationCode,
        ),
        1,
        `${screen.code}/${component.id}: annotation marker`,
      );
    }

    for (const state of screen.states) {
      assert.equal(
        countExactAttribute(svg, 'data-screen-state', state),
        1,
        `${screen.code}/${state}`,
      );
      assert.match(
        svg,
        new RegExp(escapeXml(SCREEN_STATE_LABELS[state]), 'u'),
        `${screen.code}/${state}: Vietnamese label`,
      );
    }

    assert.match(svg, /Trạng thái màn hình/u, screen.code);
    assert.match(svg, /Danh mục chú thích/u, screen.code);
    assert.match(svg, new RegExp(escapeXml(WARNING), 'u'), screen.code);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b/iu, screen.code);
    assert.doesNotMatch(svg, /\son[a-z]+\s*=/iu, screen.code);
    assert.doesNotMatch(
      svg,
      /(?:href|xlink:href)\s*=\s*["']https?:|url\(\s*["']?https?:/iu,
      screen.code,
    );
    assert.doesNotMatch(svg, /shopee/iu, screen.code);

    const accentElements = svg.match(/<[^>]+(?:#F67993|#FFF0F3)[^>]*>/gu) ?? [];
    assert.ok(accentElements.length > 0, `${screen.code}: accent coverage`);
    for (const element of accentElements) {
      assert.match(
        element,
        /data-accent-purpose="(?:primary-cta|focus|selection|annotation-ownership)"/u,
        `${screen.code}: ${element}`,
      );
    }
  }
});

test('should compose deterministic layers in the approved semantic order', () => {
  const screen = SCREEN_CONTRACTS[0];
  assert.ok(screen);
  const layout = layoutScreen(screen, 'wireframe');
  const first = renderWireframe(screen, layout, TEST_FONT_DATA);
  const second = renderWireframe(screen, layout, TEST_FONT_DATA);

  assert.equal(first, second);
  const layers = [
    'backgrounds',
    'components',
    'markers',
    'states',
    'directory',
    'warning',
  ] as const;
  let previous = -1;
  for (const layer of layers) {
    const index = first.indexOf(`data-layer="${layer}"`);
    assert.ok(index > previous, layer);
    previous = index;
  }
});

test('should emit a safe self-contained SVG for an authoritative contract', () => {
  const screen = SCREEN_CONTRACTS[0];
  assert.ok(screen);
  const svg = renderWireframe(
    screen,
    layoutScreen(screen, 'wireframe'),
    TEST_FONT_DATA,
  );

  assert.doesNotMatch(svg, /<script\b/iu);
  assert.doesNotMatch(svg, /<foreignObject\b/iu);
  assert.doesNotMatch(svg, /\son[a-z]+\s*=/iu);
  assert.doesNotMatch(svg, /(?:href|xlink:href)\s*=\s*["']https?:/iu);
  assert.doesNotMatch(svg, /url\(\s*["']?https?:/iu);
  assert.doesNotMatch(svg, /shopee/iu);
  assert.doesNotMatch(svg, /<iframe\b|<object\b|<embed\b/iu);
});

test('should escape untrusted primitive text and attributes without forging a screen contract', () => {
  const injected = `<&"'></text><script>bad()</script>`;
  const escaped = escapeXml(injected);
  const primitive = renderDirectoryEntry(
    { x: 0, y: 0, width: 400, height: 80 },
    injected,
    [injected, injected, injected],
  );

  assert.equal(
    escaped,
    '&lt;&amp;&quot;&apos;&gt;&lt;/text&gt;&lt;script&gt;bad()&lt;/script&gt;',
  );
  assert.equal(primitive.includes(escaped), true);
  assert.doesNotMatch(primitive, /<script\b|<\/text><script>/iu);
  assert.equal(
    countExactAttribute(primitive, 'data-directory-component-id', escaped),
    1,
  );
});

test('should reject unsafe runtime SVG style attributes', () => {
  const options = {
    x: 12,
    y: 24,
    lines: ['Nội dung an toàn'],
    fontSize: 16,
    lineHeight: 20,
  } as const;
  const valid = renderText({
    ...options,
    fill: '#25272B',
    weight: 600,
    anchor: 'start',
  });
  assert.doesNotMatch(valid, /\son[a-z]+\s*=/iu);

  assert.throws(
    () =>
      renderText({
        ...options,
        fill: `#25272B"/><script>bad()</script><text fill="`,
      }),
    /safe SVG fill/u,
  );
  assert.throws(
    () => renderText({ ...options, weight: 900 as 600 }),
    /font weight/u,
  );
  assert.throws(
    () =>
      renderText({
        ...options,
        anchor: `start" onload="bad()` as 'start',
      }),
    /text anchor/u,
  );
});

test('should load only the exact pinned Plus Jakarta Sans font and OFL assets', () => {
  assert.equal(
    createHash('sha256').update(PINNED_FONT_BYTES).digest('hex'),
    PINNED_FONT_SHA256,
  );
  assert.equal(
    createHash('sha256').update(PINNED_OFL_BYTES).digest('hex'),
    PINNED_OFL_SHA256,
  );

  const screen = SCREEN_CONTRACTS[0];
  assert.ok(screen);
  const layout = layoutScreen(screen, 'wireframe');
  assert.equal(
    renderWireframe(screen, layout, TEST_FONT_DATA).includes(TEST_FONT_DATA),
    true,
  );

  const mutatedFont = Buffer.from(PINNED_FONT_BYTES);
  const lastByteIndex = mutatedFont.length - 1;
  const lastByte = mutatedFont[lastByteIndex];
  assert.notEqual(lastByte, undefined);
  mutatedFont[lastByteIndex] = (lastByte ?? 0) ^ 0x01;

  const invalidFonts = [
    Buffer.from('<script>bad()</script>').toString('base64'),
    mutatedFont.toString('base64'),
  ];
  for (const fontData of invalidFonts) {
    assert.throws(
      () => renderWireframe(screen, layout, fontData),
      /exact pinned Plus Jakarta Sans TrueType font/u,
    );
  }
});

test('should reject every same-code screen forgery against the authoritative contract', () => {
  const source = SCREEN_CONTRACTS[0];
  assert.ok(source);
  const layout = layoutScreen(source, 'wireframe');
  const firstComponent = source.components[0];
  assert.ok(firstComponent);

  const forgeries: readonly [string, TScreenContract][] = [
    ['title', { ...source, title: 'Forged title' }],
    [
      'displayTitle/Shopee',
      { ...source, displayTitle: 'Shopee Affiliate Center' },
    ],
    ['pageKey', { ...source, pageKey: '3-02-ui' }],
    ['surface', { ...source, surface: 'admin' }],
    ['actor', { ...source, actor: 'Người giả mạo' }],
    ['route', { ...source, route: '/forged-route' }],
    ['layoutRecipe', { ...source, layoutRecipe: 'form' }],
    ['primaryAction', { ...source, primaryAction: 'Hành động giả' }],
    ['safeExit', { ...source, safeExit: 'Thoát giả' }],
    ['states', { ...source, states: source.states.slice(1) }],
    [
      'component label',
      {
        ...source,
        components: [
          { ...firstComponent, label: 'Nhãn giả' },
          ...source.components.slice(1),
        ],
      },
    ],
    [
      'component binding',
      {
        ...source,
        components: [
          { ...firstComponent, binding: '`forged.binding`' },
          ...source.components.slice(1),
        ],
      },
    ],
  ];

  for (const [field, forged] of forgeries) {
    assert.throws(
      () => renderWireframe(forged, layout, TEST_FONT_DATA),
      /authoritative screen contract/u,
      field,
    );
  }
});

test('should accept a semantically exact clone and reject explicit layout recipe drift', () => {
  const source = SCREEN_CONTRACTS[0];
  assert.ok(source);
  const layout = layoutScreen(source, 'wireframe');
  const exactClone = structuredClone(source) as TScreenContract;

  assert.equal(
    renderWireframe(exactClone, layout, TEST_FONT_DATA),
    renderWireframe(source, layout, TEST_FONT_DATA),
  );
  assert.throws(
    () =>
      renderWireframe(
        source,
        { ...layout, recipe: 'form' } as TScreenLayout,
        TEST_FONT_DATA,
      ),
    /layout recipe/u,
  );
});

test('should reject unaudited fidelity, mismatched contracts and unsafe font data', () => {
  const screen = SCREEN_CONTRACTS[0];
  const other = SCREEN_CONTRACTS[1];
  assert.ok(screen && other);
  const layout = layoutScreen(screen, 'wireframe');

  assert.throws(
    () =>
      renderWireframe(
        screen,
        { ...layout, fidelity: 'high-fidelity' },
        TEST_FONT_DATA,
      ),
    /wireframe fidelity/u,
  );
  assert.throws(
    () => renderWireframe(other, layout, TEST_FONT_DATA),
    /screen code/u,
  );
  assert.throws(
    () => renderWireframe(screen, layout, `not canonical base64`),
    /base64 font data/u,
  );
});
