import assert from 'node:assert/strict';
import test from 'node:test';
import { auditScreenGeometry } from './geometry-audit.ts';
import {
  HIGH_FIDELITY_ZONES,
  LAYOUT_RECIPE_BUILDERS,
  layoutScreen,
  SCREEN_CANVAS,
  WIREFRAME_ZONES,
} from './layout-recipes.ts';
import { MOCKUP_SCREEN_CODES } from './manifest.ts';
import { SCREEN_CONTRACTS, SCREEN_STATE_LABELS } from './screen-contracts.ts';

const EXPECTED_RECIPES = [
  'dashboard',
  'form',
  'list',
  'detail',
  'composer',
  'viewer',
  'evidence',
  'reconciliation',
] as const;

test('should expose the exact fixed desktop canvas and wireframe zones', () => {
  assert.deepEqual(SCREEN_CANVAS, { width: 1920, height: 1440 });
  assert.deepEqual(WIREFRAME_ZONES, {
    chrome: { x: 32, y: 24, width: 1856, height: 88 },
    primary: { x: 32, y: 128, width: 1856, height: 900 },
    states: { x: 32, y: 1044, width: 1856, height: 140 },
    directory: { x: 32, y: 1200, width: 1856, height: 208 },
  });
});

test('should implement every approved recipe exactly once', () => {
  assert.deepEqual(Object.keys(LAYOUT_RECIPE_BUILDERS), EXPECTED_RECIPES);
  assert.deepEqual(
    [...new Set(SCREEN_CONTRACTS.map((screen) => screen.layoutRecipe))].sort(),
    [...EXPECTED_RECIPES].sort(),
  );
});

test('should layout all fifty-nine screen contracts without losing components', () => {
  for (const screen of SCREEN_CONTRACTS) {
    const layout = layoutScreen(screen, 'wireframe');

    assert.equal(layout.width, 1920);
    assert.equal(layout.height, 1440);
    assert.equal(layout.fidelity, 'wireframe');
    assert.equal(layout.screenCode, screen.code);
    assert.equal(layout.recipe, screen.layoutRecipe);
    assert.deepEqual(
      layout.componentPlacements.map((item) => item.componentId),
      screen.components.map((item) => item.id),
      `${screen.code}: contract order`,
    );
    assert.deepEqual(
      layout.componentPlacements.map((item) => item.annotationCode),
      screen.components.map((item) => item.annotationCode),
      `${screen.code}: annotation ownership`,
    );
    assert.equal(
      new Set(layout.componentPlacements.map((item) => item.componentId)).size,
      screen.components.length,
      screen.code,
    );
    assert.deepEqual(
      layout.statePlacements.map((item) => item.state),
      screen.states,
      `${screen.code}: state order`,
    );
    assert.deepEqual(
      layout.statePlacements.map((item) => item.displayLabel),
      screen.states.map((state) => SCREEN_STATE_LABELS[state]),
      `${screen.code}: Vietnamese state labels`,
    );
    assert.deepEqual(
      layout.directoryPlacements.map((item) => item.componentId),
      screen.components.map((item) => item.id),
      `${screen.code}: directory ownership`,
    );
    assert.deepEqual(
      layout.directoryPlacements.map((item) => ({
        annotationCode: item.annotationCode,
        type: item.type,
        requirement: item.requirement,
        binding: item.binding,
      })),
      screen.components.map((item) => ({
        annotationCode: item.annotationCode,
        type: item.type,
        requirement: item.requirement,
        binding: item.binding,
      })),
      `${screen.code}: normative directory fields`,
    );
    assert.equal(layout.primaryActionPlacement?.label, screen.primaryAction);
    assert.equal(
      layout.primaryActionPlacement?.componentId,
      screen.components.find((item) => item.region === 'footer')?.id,
    );
    assert.equal(layout.primaryActionPlacement?.interactive, true);
    assert.equal(layout.safeExitPlacement?.label, screen.safeExit);
    assert.equal(layout.safeExitPlacement?.componentId, null);
    assert.equal(layout.safeExitPlacement?.interactive, true);
    assert.equal(
      layout.scenePrimitives.some(
        (primitive) =>
          primitive.kind === 'text' && primitive.role === 'screen-title',
      ),
      true,
      `${screen.code}: screen title primitive`,
    );
    for (const component of screen.components) {
      assert.equal(
        layout.scenePrimitives.some(
          (primitive) =>
            primitive.kind === 'text' &&
            primitive.ownerId === `component:${component.id}`,
        ),
        true,
        `${screen.code}/${component.id}: scene ownership`,
      );
    }
    assert.deepEqual(auditScreenGeometry(layout), [], screen.code);
  }
});

test('should retain deterministic geometry for repeated calls', () => {
  for (const screen of SCREEN_CONTRACTS) {
    assert.deepEqual(
      layoutScreen(screen, 'wireframe'),
      layoutScreen(screen, 'wireframe'),
      screen.code,
    );
  }
});

test('should give all eight recipes distinct structural geometry for the same contract', () => {
  const source = SCREEN_CONTRACTS[0];
  assert.ok(source);
  const fingerprints = EXPECTED_RECIPES.map((recipe) => {
    const layout = layoutScreen(
      { ...source, layoutRecipe: recipe },
      'wireframe',
    );
    return layout.componentPlacements
      .map(({ rect }) => `${rect.x},${rect.y},${rect.width},${rect.height}`)
      .join('|');
  });

  assert.equal(new Set(fingerprints).size, EXPECTED_RECIPES.length);
  assert.notEqual(
    fingerprints[EXPECTED_RECIPES.indexOf('list')],
    fingerprints[EXPECTED_RECIPES.indexOf('reconciliation')],
  );
});

test('should classify controls before recipe-specific visual fallbacks', () => {
  const mismatches: string[] = [];

  for (const screen of SCREEN_CONTRACTS) {
    const layout = layoutScreen(screen, 'wireframe');
    for (const placement of layout.componentPlacements) {
      const component = screen.components[placement.contractIndex];
      assert.ok(component);
      const owner = `${screen.code}/${component.id}`;

      if (
        component.id.startsWith('F') &&
        (placement.visualRole !== 'field' ||
          placement.placeholderKind !== 'form' ||
          !placement.interactive)
      ) {
        mismatches.push(`${owner}:field`);
      }
      if (
        component.id.startsWith('A') &&
        (placement.visualRole !== 'action' ||
          placement.placeholderKind !== 'form' ||
          !placement.interactive)
      ) {
        mismatches.push(`${owner}:action`);
      }
      if (
        component.id.startsWith('D') &&
        /cảnh báo|huy hiệu|trạng thái/iu.test(component.type) &&
        (placement.visualRole !== 'status' ||
          placement.placeholderKind === 'image' ||
          placement.placeholderKind === 'video')
      ) {
        mismatches.push(`${owner}:status`);
      }
    }
  }

  assert.deepEqual(mismatches, []);

  const probes = [
    ['MH-006', 'F02', 'field', 'form'],
    ['MH-005', 'F02', 'field', 'form'],
    ['MH-022', 'A01', 'action', 'form'],
  ] as const;
  for (const [code, componentId, role, kind] of probes) {
    const screen = SCREEN_CONTRACTS.find((item) => item.code === code);
    assert.ok(screen);
    const placement = layoutScreen(
      screen,
      'wireframe',
    ).componentPlacements.find((item) => item.componentId === componentId);
    assert.ok(placement);
    assert.equal(placement.visualRole, role, `${code}/${componentId}`);
    assert.equal(placement.placeholderKind, kind, `${code}/${componentId}`);
  }
});

test('should recognize Vietnamese control terms without media substring collisions', () => {
  const source = SCREEN_CONTRACTS[0];
  const first = source?.components[0];
  assert.ok(source && first);
  const probes = [
    ['Bộ chọn', 'field', 'form', true],
    ['Vùng văn bản', 'field', 'form', true],
    ['Hộp kiểm', 'field', 'form', true],
    ['Nhóm lựa chọn', 'field', 'form', true],
    ['Tải lên', 'field', 'form', true],
    ['Tải tệp', 'field', 'form', true],
    ['Nút', 'action', 'form', true],
    ['Nhóm nút', 'action', 'form', true],
    ['Công tắc', 'field', 'form', true],
    ['Tab', 'navigation', 'form', true],
    ['Menu', 'navigation', 'form', true],
    ['Accordion', 'navigation', 'form', true],
    ['Cảnh báo ảnh hưởng', 'status', 'generic', false],
    ['Ảnh đại diện', 'media', 'avatar', false],
  ] as const;

  for (const [type, role, kind, interactive] of probes) {
    const screen = {
      ...source,
      components: [{ ...first, type }, ...source.components.slice(1)],
    };
    const placement = layoutScreen(screen, 'wireframe').componentPlacements[0];
    assert.ok(placement);
    assert.equal(placement.visualRole, role, type);
    assert.equal(placement.placeholderKind, kind, type);
    assert.equal(placement.interactive, interactive, type);
  }
});

test('should recursively freeze every nested geometry rectangle', () => {
  for (const screen of SCREEN_CONTRACTS) {
    const layout = layoutScreen(screen, 'wireframe');
    const rects = [
      ...Object.values(layout.zones).filter((rect) => rect !== null),
      ...layout.componentPlacements.map((item) => item.rect),
      layout.primaryActionPlacement?.rect,
      layout.safeExitPlacement?.rect,
      ...layout.statePlacements.map((item) => item.rect),
      ...layout.directoryPlacements.map((item) => item.rect),
      ...layout.scenePrimitives.map((item) => item.rect),
    ].filter((rect) => rect !== undefined);

    for (const rect of rects) {
      assert.equal(Object.isFrozen(rect), true, screen.code);
      assert.throws(() => {
        (rect as { x: number }).x += 1;
      }, TypeError);
    }
    assert.deepEqual(auditScreenGeometry(layout), [], screen.code);
  }
});

test('should fit every production text primitive without overflow', () => {
  const overflow = SCREEN_CONTRACTS.flatMap((screen) =>
    auditScreenGeometry(layoutScreen(screen, 'wireframe'))
      .filter((error) => /text|font|metrics|visible/i.test(error))
      .map((error) => `${screen.code}: ${error}`),
  );
  assert.deepEqual(overflow, []);
});

test('should fit twelve representative high-fidelity layouts without a directory', () => {
  assert.deepEqual(HIGH_FIDELITY_ZONES.chrome, WIREFRAME_ZONES.chrome);

  for (const code of MOCKUP_SCREEN_CODES) {
    const screen = SCREEN_CONTRACTS.find(
      (candidate) => candidate.code === code,
    );
    assert.ok(screen, code);

    const layout = layoutScreen(screen, 'high-fidelity');
    assert.equal(layout.fidelity, 'high-fidelity');
    assert.equal(layout.width, SCREEN_CANVAS.width);
    assert.equal(layout.height, SCREEN_CANVAS.height);
    assert.equal(layout.zones.directory, null);
    assert.deepEqual(layout.directoryPlacements, []);
    assert.deepEqual(
      layout.componentPlacements.map((item) => item.componentId),
      screen.components.map((item) => item.id),
      code,
    );
    assert.deepEqual(auditScreenGeometry(layout), [], code);
  }
});
