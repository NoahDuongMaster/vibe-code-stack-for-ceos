import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { auditSceneAccessibility } from './accessibility-audit.ts';
import { BENADEP_THEME, BENADEP_THEME_SOURCES } from './benadep-theme.ts';
import { layoutScreen } from './layout-recipes.ts';
import { MOCKUP_SCREEN_CODES, MOCKUP_TARGETS } from './manifest.ts';
import { renderMockup } from './mockup-renderer.ts';
import { escapeXml } from './scene-primitives.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';
import type { TScreenContract, TScreenLayout } from './types.ts';

const FONT_BYTES = readFileSync(
  new URL('./fonts/PlusJakartaSans-VariableFont_wght.ttf', import.meta.url),
);
const FONT_DATA = FONT_BYTES.toString('base64');

const EXPECTED_COMPOSITION_BY_CODE = Object.freeze({
  'MH-001': 'affiliate-center-eligibility',
  'MH-006': 'affiliate-performance-dashboard',
  'MH-012': 'custom-link-builder',
  'MH-018': 'attribution-decision-detail',
  'MH-022': 'video-commerce-feed',
  'MH-030': 'viewer-live-room',
  'MH-033': 'product-commission-rates',
  'MH-036': 'collaboration-inbox',
  'MH-042': 'mcn-roster-management',
  'MH-046': 'creator-wallet',
  'MH-052': 'risk-case-queue',
  'MH-058': 'product-feed-health',
} as const);

const countAttribute = (
  scene: string,
  attribute: string,
  value: string,
): number =>
  scene.match(
    new RegExp(
      `${attribute}="${value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}"`,
      'gu',
    ),
  )?.length ?? 0;

const screenByCode = (
  code: (typeof MOCKUP_SCREEN_CODES)[number],
): TScreenContract => {
  const screen = SCREEN_CONTRACTS.find((candidate) => candidate.code === code);
  assert.ok(screen, code);
  return screen;
};

const renderScreen = (
  code: (typeof MOCKUP_SCREEN_CODES)[number],
): Readonly<{ screen: TScreenContract; scene: string }> => {
  const screen = screenByCode(code);
  return {
    screen,
    scene: renderMockup(
      screen,
      layoutScreen(screen, 'high-fidelity'),
      FONT_DATA,
    ),
  };
};

const componentFragment = (
  screen: TScreenContract,
  scene: string,
  componentId: string,
): string => {
  const componentIndex = screen.components.findIndex(
    (component) => component.id === componentId,
  );
  assert.notEqual(componentIndex, -1, `${screen.code}/${componentId}`);
  const start = scene.indexOf(`data-component-id="${componentId}"`);
  assert.notEqual(start, -1, `${screen.code}/${componentId}`);
  const nextComponent = screen.components[componentIndex + 1];
  const end = nextComponent
    ? scene.indexOf(`data-component-id="${nextComponent.id}"`, start)
    : scene.indexOf('<g data-layer="states">', start);
  return scene.slice(start, end === -1 ? undefined : end);
};

const firstHexAttribute = (
  fragment: string,
  element: 'rect' | 'text',
  attribute: 'fill',
): string => {
  const match = new RegExp(
    `<${element}[^>]*${attribute}="(#[0-9A-F]{6})"`,
    'u',
  ).exec(fragment);
  assert.ok(match?.[1], `${element}/${attribute}`);
  return match[1];
};

const contrastRatio = (foreground: string, background: string): number => {
  const luminance = (hex: string): number => {
    const channels = hex
      .slice(1)
      .match(/.{2}/gu)
      ?.map((channel) => Number.parseInt(channel, 16) / 255);
    assert.ok(channels && channels.length === 3, hex);
    const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

test('should expose the exact approved Benadep theme and reviewable source metadata', () => {
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

  assert.deepEqual(
    Object.keys(BENADEP_THEME_SOURCES),
    Object.keys(BENADEP_THEME),
  );
  for (const source of Object.values(BENADEP_THEME_SOURCES)) {
    assert.match(
      source.path,
      /benadep|notion-srs-ui-wireframes-mockups-design/u,
    );
    assert.ok(source.token.length > 0);
  }
  assert.equal(BENADEP_THEME_SOURCES.primary.token, '--primary');
  assert.equal(BENADEP_THEME_SOURCES.deepPlum.token, '--accent');
});

test('should render twelve deterministic screen-specific mockups from authoritative contracts', () => {
  assert.equal(MOCKUP_SCREEN_CODES.length, 12);

  for (const code of MOCKUP_SCREEN_CODES) {
    const screen = SCREEN_CONTRACTS.find(
      (candidate) => candidate.code === code,
    );
    assert.ok(screen, code);
    const layout = layoutScreen(screen, 'high-fidelity');
    const scene = renderMockup(screen, layout, FONT_DATA);

    assert.equal(scene, renderMockup(screen, layout, FONT_DATA), code);
    assert.match(scene, /viewBox="0 0 1920 1440"/u, code);
    assert.match(scene, /width="1920" height="1440"/u, code);
    assert.match(scene, /data-fidelity="high-fidelity"/u, code);
    assert.match(scene, /data-font-family="Plus Jakarta Sans"/u, code);
    assert.equal(
      scene.includes(
        `data-composition="${EXPECTED_COMPOSITION_BY_CODE[code]}"`,
      ),
      true,
      code,
    );
    assert.equal(scene.includes(escapeXml(screen.displayTitle)), true, code);
    assert.equal(scene.includes(escapeXml(screen.actor)), true, code);
    assert.equal(scene.includes(escapeXml(screen.primaryAction)), true, code);
    assert.equal(scene.includes('Quay lại an toàn'), true, code);
    assert.doesNotMatch(
      scene,
      /data-layer="directory"|Danh mục chú thích/u,
      code,
    );

    const renderedIds = [
      ...scene.matchAll(/data-component-id="([^"]+)"/gu),
    ].map((match) => match[1]);
    assert.deepEqual(
      renderedIds,
      screen.components.map((component) => component.id),
      `${code}: component order`,
    );
    for (const component of screen.components) {
      assert.equal(
        countAttribute(scene, 'data-component-id', component.id),
        1,
        `${code}/${component.id}`,
      );
      assert.equal(
        scene.includes(escapeXml(component.label)),
        true,
        component.id,
      );
    }

    assert.deepEqual(auditSceneAccessibility(scene), [], code);
    assert.doesNotMatch(
      scene,
      /<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b/iu,
      code,
    );
    assert.doesNotMatch(scene, /\son[a-z]+\s*=/iu, code);
    assert.doesNotMatch(scene, /<image\b|(?:xlink:)?href\s*=/iu, code);
    assert.doesNotMatch(scene, /url\(\s*["']?https?:|https?:\/\//iu, code);
    assert.doesNotMatch(scene, /shopee/iu, code);
  }
});

test('should reserve the rose-to-plum proof rail for structural evidence screens only', () => {
  const railCodes = new Set(['MH-018', 'MH-052', 'MH-058']);

  for (const code of MOCKUP_SCREEN_CODES) {
    const screen = SCREEN_CONTRACTS.find(
      (candidate) => candidate.code === code,
    );
    assert.ok(screen, code);
    const scene = renderMockup(
      screen,
      layoutScreen(screen, 'high-fidelity'),
      FONT_DATA,
    );
    assert.equal(
      /data-proof-rail="rose-to-plum"/u.test(scene),
      railCodes.has(code),
      code,
    );
  }
});

test('should use only contract-owned fields and actions with neutral labeled media', () => {
  for (const code of MOCKUP_SCREEN_CODES) {
    const screen = SCREEN_CONTRACTS.find(
      (candidate) => candidate.code === code,
    );
    assert.ok(screen, code);
    const layout = layoutScreen(screen, 'high-fidelity');
    const scene = renderMockup(screen, layout, FONT_DATA);

    const semanticOwners = [
      ...scene.matchAll(
        /data-component-id="([^"]+)"[^>]*data-semantic-role="(field|action)"/gu,
      ),
    ].map((match) => `${match[1]}:${match[2]}`);
    const expectedOwners = layout.componentPlacements
      .filter(
        (placement) =>
          placement.visualRole === 'field' || placement.visualRole === 'action',
      )
      .map((placement) => `${placement.componentId}:${placement.visualRole}`);
    assert.deepEqual(semanticOwners, expectedOwners, code);

    if (
      layout.componentPlacements.some(
        (placement) => placement.visualRole === 'media',
      )
    ) {
      assert.match(scene, /Vùng giữ chỗ trung tính/u, code);
    }
  }
});

test('should render source-faithful chrome variants for storefront, vendor and admin surfaces', () => {
  for (const code of MOCKUP_SCREEN_CODES) {
    const { screen, scene } = renderScreen(code);
    if (screen.surface === 'vendor') {
      assert.match(
        scene,
        /data-layer="chrome" data-chrome-variant="vendor-portal"/u,
        code,
      );
      assert.match(
        scene,
        /<g data-chrome-region="vendor-topbar">\s*<rect\b[^>]*height="80"/u,
        `${code}: vendor topbar 80px`,
      );
      assert.match(
        scene,
        /<g data-chrome-region="vendor-sidebar">\s*<rect\b[^>]*width="240"/u,
        `${code}: vendor sidebar 240px`,
      );
      continue;
    }

    if (screen.surface === 'admin') {
      assert.match(
        scene,
        /data-layer="chrome" data-chrome-variant="admin-extension"/u,
        code,
      );
      assert.match(scene, /data-chrome-region="admin-extension-toolbar"/u);
      assert.doesNotMatch(scene, />BENADEP</u, `${code}: no full brand shell`);
      assert.doesNotMatch(
        scene,
        /data-chrome-region="(?:account-sidebar|vendor-sidebar)"/u,
        code,
      );
      continue;
    }

    const accountRoute = screen.route.startsWith('/account/');
    if (accountRoute && screen.layoutRecipe !== 'viewer') {
      assert.match(
        scene,
        /data-layer="chrome" data-chrome-variant="storefront-account"/u,
        code,
      );
      assert.match(scene, /data-chrome-region="account-sidebar"/u, code);
    } else {
      assert.match(
        scene,
        /data-layer="chrome" data-chrome-variant="storefront-viewer"/u,
        code,
      );
      assert.match(scene, /data-chrome-region="viewer-header"/u, code);
      assert.doesNotMatch(scene, /data-chrome-region="account-sidebar"/u, code);
    }
  }
});

test('should preserve exact component-to-visual semantics instead of generic substitutes', () => {
  const expected = Object.freeze({
    'MH-001': { D01: 'hero-card', D03: 'alert' },
    'MH-006': { D01: 'stats-cards' },
    'MH-022': { D01: 'virtual-feed', D02: 'video-player' },
    'MH-030': { D01: 'live-player' },
    'MH-036': { D03: 'countdown' },
    'MH-046': { D01: 'stats-cards', D03: 'ledger' },
    'MH-052': { D03: 'countdown', D04: 'toolbar' },
    'MH-058': { D01: 'stats-cards', D03: 'diff' },
  } as const);

  for (const [code, mappings] of Object.entries(expected)) {
    const typedCode = code as keyof typeof expected;
    const { screen, scene } = renderScreen(typedCode);
    for (const [componentId, visual] of Object.entries(mappings)) {
      const fragment = componentFragment(screen, scene, componentId);
      assert.match(
        fragment,
        new RegExp(`data-visual-semantic="${visual}"`, 'u'),
        `${code}/${componentId}`,
      );
      assert.match(
        fragment,
        new RegExp(`data-visual="${visual}"`, 'u'),
        `${code}/${componentId}: rendered visual`,
      );
    }
  }
});

test('should render only component-owned statuses from the authoritative contract', () => {
  for (const code of MOCKUP_SCREEN_CODES) {
    const { screen, scene } = renderScreen(code);
    for (const component of screen.components) {
      const fragment = componentFragment(screen, scene, component.id);
      const renderedStatuses = [...fragment.matchAll(/data-status="([^"]+)"/gu)]
        .map((match) => match[1])
        .filter((state): state is NonNullable<typeof state> => Boolean(state));
      for (const renderedStatus of renderedStatuses) {
        assert.equal(
          component.states.includes(
            renderedStatus as (typeof component.states)[number],
          ),
          true,
          `${code}/${component.id}: ${renderedStatus} is not contract-owned`,
        );
      }
    }
  }
});

test('should keep MH-052 bulk-operation content non-interactive and preserve A01 action ownership', () => {
  const { screen, scene } = renderScreen('MH-052');
  const layout = layoutScreen(screen, 'high-fidelity');
  const bulkOperations = componentFragment(screen, scene, 'D04');
  assert.equal(
    countAttribute(bulkOperations, 'data-a11y-kind', 'control'),
    0,
    'MH-052/D04 is descriptive content, not a contract-owned control',
  );
  assert.doesNotMatch(
    bulkOperations,
    /Chọn tất cả|Gán xử lý|Cập nhật/u,
    'MH-052/D04 must not invent action labels outside the SRS contract',
  );

  assert.equal(layout.primaryActionPlacement?.componentId, 'A01');
  const contractAction = componentFragment(screen, scene, 'A01');
  assert.equal(
    countAttribute(contractAction, 'data-contract-action', 'primary-action'),
    1,
    'MH-052/A01 remains the sole primary contract action owner',
  );
  assert.equal(
    contractAction.includes(escapeXml(screen.primaryAction)),
    true,
    'MH-052/A01 keeps the authoritative primary action label',
  );
});

test('should use the exact accessible Benadep primary treatment for every primary CTA', () => {
  for (const code of MOCKUP_SCREEN_CODES) {
    const { scene } = renderScreen(code);
    const start = scene.indexOf('data-contract-action="primary-action"');
    assert.notEqual(start, -1, code);
    const end = scene.indexOf('</g>', start);
    assert.notEqual(end, -1, code);
    const primaryAction = scene.slice(start, end);
    const fill = firstHexAttribute(primaryAction, 'rect', 'fill');
    const foreground = firstHexAttribute(primaryAction, 'text', 'fill');
    assert.equal(fill, '#E9486A', `${code}: primary fill`);
    assert.ok(
      foreground === '#0F1A2A' || foreground === '#1D1018',
      `${code}: primary foreground ${foreground}`,
    );
    assert.ok(
      contrastRatio(foreground, fill) >= 4.5,
      `${code}: primary CTA must meet WCAG AA`,
    );
  }
});

test('should make the MH-030 LIVE player physically dominant with a clear semantic hierarchy', () => {
  const { screen, scene } = renderScreen('MH-030');
  const fragment = componentFragment(screen, scene, 'D01');
  assert.match(fragment, /data-visual-semantic="live-player"/u);
  assert.doesNotMatch(fragment, /data-visual="neutral-media"/u);
  const player =
    /<g data-visual="live-player" data-hierarchy="dominant"[^>]*>\s*<rect\b[^>]*width="([0-9.]+)" height="([0-9.]+)"/u.exec(
      fragment,
    );
  assert.ok(player, 'MH-030/D01: missing dominant LIVE player region');
  const width = Number(player[1]);
  const height = Number(player[2]);
  assert.ok(width >= 1000, `MH-030/D01: player width ${width}px`);
  assert.ok(height >= 480, `MH-030/D01: player height ${height}px`);
  assert.ok(width * height >= 500_000, 'MH-030/D01: player is not dominant');
});

test('should expose every full state label without ellipsis and with accessible names', () => {
  for (const code of MOCKUP_SCREEN_CODES) {
    const { screen, scene } = renderScreen(code);
    const layout = layoutScreen(screen, 'high-fidelity');
    const start = scene.indexOf('<g data-layer="states"');
    const end = scene.indexOf('<g data-layer="warning"', start);
    assert.notEqual(start, -1, code);
    assert.notEqual(end, -1, code);
    const stateStrip = scene.slice(start, end);
    assert.match(
      stateStrip,
      /<g data-layer="states" aria-label="Trạng thái màn hình">/u,
      code,
    );
    assert.doesNotMatch(stateStrip, /…|\.\.\./u, code);
    for (const placement of layout.statePlacements) {
      assert.equal(
        stateStrip.includes(escapeXml(placement.displayLabel)),
        true,
        `${code}/${placement.state}: full label`,
      );
      assert.match(
        stateStrip,
        new RegExp(
          `data-screen-state="${placement.state}" aria-label="${escapeXml(placement.displayLabel)}"`,
          'u',
        ),
        `${code}/${placement.state}: accessible name`,
      );
    }
  }
});

test('should reject forged contracts, forged high-fidelity layouts and unsafe font data', () => {
  const screen = SCREEN_CONTRACTS.find(
    (candidate) => candidate.code === 'MH-001',
  );
  assert.ok(screen);
  const layout = layoutScreen(screen, 'high-fidelity');
  const exactScreenClone = structuredClone(screen) as TScreenContract;
  const exactLayoutClone = structuredClone(layout) as TScreenLayout;
  assert.equal(
    renderMockup(exactScreenClone, exactLayoutClone, FONT_DATA),
    renderMockup(screen, layout, FONT_DATA),
  );

  assert.throws(
    () =>
      renderMockup(
        { ...screen, displayTitle: '</text><script>bad()</script>' },
        layout,
        FONT_DATA,
      ),
    /authoritative screen contract/u,
  );
  const firstPlacement = layout.componentPlacements[0];
  assert.ok(firstPlacement);
  assert.throws(
    () =>
      renderMockup(
        screen,
        {
          ...layout,
          componentPlacements: [
            { ...firstPlacement, rect: { ...firstPlacement.rect, x: 56 } },
            ...layout.componentPlacements.slice(1),
          ],
        },
        FONT_DATA,
      ),
    /authoritative high-fidelity layout/u,
  );
  assert.throws(
    () => renderMockup(screen, layoutScreen(screen, 'wireframe'), FONT_DATA),
    /high-fidelity layout/u,
  );

  const mutated = Buffer.from(FONT_BYTES);
  const index = mutated.length - 1;
  mutated[index] = (mutated[index] ?? 0) ^ 1;
  for (const fontData of [
    mutated.toString('base64'),
    `${FONT_DATA}</style><script>bad()</script>`,
  ]) {
    assert.throws(
      () => renderMockup(screen, layout, fontData),
      /pinned Plus Jakarta Sans|base64 font data/u,
    );
  }
});
