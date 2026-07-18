import assert from 'node:assert/strict';
import test from 'node:test';
import { auditScreenGeometry } from './geometry-audit.ts';
import { layoutScreen } from './layout-recipes.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';

import type {
  TComponentPlacement,
  TDirectoryPlacement,
  TScenePrimitive,
  TScreenLayout,
  TStatePlacement,
} from './types.ts';

const BASE_SCREEN = SCREEN_CONTRACTS[0];
assert.ok(BASE_SCREEN);

const baseLayout = (): TScreenLayout => layoutScreen(BASE_SCREEN, 'wireframe');

const replaceComponent = (
  layout: TScreenLayout,
  index: number,
  placement: TComponentPlacement,
): TScreenLayout => ({
  ...layout,
  componentPlacements: layout.componentPlacements.map((item, itemIndex) =>
    itemIndex === index ? placement : item,
  ),
});

test('should detect component overlap outside declared containment', () => {
  const layout = baseLayout();
  const first = layout.componentPlacements[0];
  const second = layout.componentPlacements[1];
  assert.ok(first && second);

  const invalid = replaceComponent(layout, 1, { ...second, rect: first.rect });
  assert.equal(
    auditScreenGeometry(invalid).some((error) => error.includes('overlap')),
    true,
  );
});

test('should detect text bounds leaving their declared owner', () => {
  const layout = baseLayout();
  const text = layout.scenePrimitives.find(
    (primitive): primitive is Extract<TScenePrimitive, { kind: 'text' }> =>
      primitive.kind === 'text' && primitive.ownerId?.startsWith('component:'),
  );
  assert.ok(text);

  const invalidText = {
    ...text,
    rect: { ...text.rect, x: 1900, width: 100 },
  } as const;
  const invalid: TScreenLayout = {
    ...layout,
    scenePrimitives: layout.scenePrimitives.map((primitive) =>
      primitive.id === text.id ? invalidText : primitive,
    ),
  };

  assert.equal(
    auditScreenGeometry(invalid).some((error) =>
      error.includes('text bounds leave owner'),
    ),
    true,
  );
});

test('should detect component and directory duplication or loss', () => {
  const layout = baseLayout();
  const first = layout.componentPlacements[0];
  const firstDirectory = layout.directoryPlacements[0];
  assert.ok(first && firstDirectory);

  const duplicateComponent: TScreenLayout = {
    ...layout,
    componentPlacements: [...layout.componentPlacements, first],
  };
  assert.equal(
    auditScreenGeometry(duplicateComponent).some((error) =>
      error.includes('component ownership duplication'),
    ),
    true,
  );

  const missingDirectory: TScreenLayout = {
    ...layout,
    directoryPlacements: layout.directoryPlacements.slice(1),
  };
  assert.equal(
    auditScreenGeometry(missingDirectory).some((error) =>
      error.includes('directory ownership loss'),
    ),
    true,
  );
});

test('should detect annotation duplication or loss independently from component geometry', () => {
  const layout = baseLayout();
  const first = layout.componentPlacements[0];
  const second = layout.componentPlacements[1];
  const firstDirectory = layout.directoryPlacements[0];
  assert.ok(first && second && firstDirectory);

  const duplicateAnnotation = replaceComponent(layout, 1, {
    ...second,
    annotationCode: first.annotationCode,
  });
  assert.equal(
    auditScreenGeometry(duplicateAnnotation).some((error) =>
      error.includes('annotation ownership duplication'),
    ),
    true,
  );

  const missingDirectoryAnnotation: TScreenLayout = {
    ...layout,
    directoryPlacements: [
      { ...firstDirectory, annotationCode: 'UNKNOWN' },
      ...layout.directoryPlacements.slice(1),
    ],
  };
  assert.equal(
    auditScreenGeometry(missingDirectoryAnnotation).some((error) =>
      error.includes('directory annotation ownership loss'),
    ),
    true,
  );
});

test('should reject body and annotation text below their minimum sizes', () => {
  const layout = baseLayout();
  const body = layout.scenePrimitives.find(
    (primitive): primitive is Extract<TScenePrimitive, { kind: 'text' }> =>
      primitive.kind === 'text' && primitive.role === 'body',
  );
  const annotation = layout.scenePrimitives.find(
    (primitive): primitive is Extract<TScenePrimitive, { kind: 'text' }> =>
      primitive.kind === 'text' && primitive.role === 'annotation',
  );
  assert.ok(body && annotation);

  const invalid: TScreenLayout = {
    ...layout,
    scenePrimitives: layout.scenePrimitives.map((primitive) => {
      if (primitive.id === body.id) return { ...body, fontSize: 15 };
      if (primitive.id === annotation.id) {
        return { ...annotation, fontSize: 13 };
      }
      return primitive;
    }),
  };
  const errors = auditScreenGeometry(invalid);

  assert.equal(
    errors.some((error) => error.includes('body font under 16')),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes('annotation font under 14')),
    true,
  );
});

test('should reject invalid, empty, excessive and geometrically overflowing text', () => {
  const layout = baseLayout();
  const text = layout.scenePrimitives.find(
    (primitive): primitive is Extract<TScenePrimitive, { kind: 'text' }> =>
      primitive.kind === 'text' && primitive.role === 'body',
  );
  assert.ok(text);

  const variants = [
    [{ ...text, fontSize: Number.NaN }, 'non-finite text metrics'],
    [
      { ...text, lineHeight: Number.POSITIVE_INFINITY },
      'non-finite text metrics',
    ],
    [{ ...text, maxLines: Number.NaN }, 'non-finite text metrics'],
    [
      { ...text, rect: { ...text.rect, width: Number.NaN } },
      'non-finite text metrics',
    ],
    [{ ...text, text: '' }, 'empty visible text'],
    [{ ...text, text: 'x'.repeat(10_000) }, 'excessive visible text'],
    [
      {
        ...text,
        text: 'Nội dung cần xuống nhiều dòng để vừa khung',
        maxLines: 1,
        rect: { ...text.rect, width: 60, height: 100 },
      },
      'wrapped line count exceeds maxLines',
    ],
    [
      {
        ...text,
        text: 'Nội dung cần hai dòng',
        maxLines: 10,
        rect: { ...text.rect, width: 80, height: 16 },
      },
      'text height below wrapped content',
    ],
    [
      {
        ...text,
        text: 'W',
        maxLines: 1,
        rect: { ...text.rect, width: 1, height: 100 },
      },
      'visible text line exceeds width',
    ],
  ] as const;

  for (const [variant, expected] of variants) {
    const invalid: TScreenLayout = {
      ...layout,
      scenePrimitives: layout.scenePrimitives.map((primitive) =>
        primitive.id === text.id ? variant : primitive,
      ),
    };
    assert.equal(
      auditScreenGeometry(invalid).some((error) => error.includes(expected)),
      true,
      expected,
    );
  }
});

test('should require the exact complete scene primitive contract', () => {
  const layout = baseLayout();
  const component = layout.componentPlacements.find(
    (item) => item.region !== 'footer' && item.rect.height >= 112,
  );
  assert.ok(component);
  const placeholderId = `placeholder:component:${component.componentId}`;

  const variants = [
    [{ ...layout, scenePrimitives: [] }, 'missing scene primitive'],
    [
      {
        ...layout,
        scenePrimitives: layout.scenePrimitives.filter(
          (item) => item.id !== `text:component:${component.componentId}:label`,
        ),
      },
      'missing scene primitive',
    ],
    [
      {
        ...layout,
        scenePrimitives: layout.scenePrimitives.filter(
          (item) => !item.id.startsWith('text:directory:'),
        ),
      },
      'missing scene primitive',
    ],
    [
      {
        ...layout,
        scenePrimitives: layout.scenePrimitives.map((item) =>
          item.id === 'zone:states' && item.kind === 'panel'
            ? { ...item, role: 'chrome' as const }
            : item,
        ),
      },
      'scene primitive role mismatch',
    ],
    [
      {
        ...layout,
        scenePrimitives: layout.scenePrimitives.map((item) =>
          item.id === 'text:safe-exit'
            ? { ...item, ownerId: 'zone:primary' }
            : item,
        ),
      },
      'scene primitive owner mismatch',
    ],
    [
      {
        ...layout,
        scenePrimitives: [
          ...layout.scenePrimitives,
          {
            kind: 'text' as const,
            id: 'text:extra',
            ownerId: 'zone:chrome',
            role: 'body' as const,
            text: 'Nội dung thừa',
            rect: { x: 100, y: 60, width: 120, height: 22 },
            fontSize: 16,
            lineHeight: 22,
            maxLines: 1,
          },
        ],
      },
      'unexpected scene primitive',
    ],
    [
      {
        ...layout,
        scenePrimitives: layout.scenePrimitives.map((item) =>
          item.id === placeholderId && item.kind === 'placeholder'
            ? { ...item, placeholderKind: 'video' as const }
            : item,
        ),
      },
      'placeholder kind mismatch',
    ],
  ] as const satisfies readonly (readonly [TScreenLayout, string])[];

  for (const [invalid, expected] of variants) {
    assert.equal(
      auditScreenGeometry(invalid).some((error) => error.includes(expected)),
      true,
      expected,
    );
  }
});

test('should reject swapped ownership, invalid indexes and empty directory metadata', () => {
  const layout = baseLayout();
  const first = layout.componentPlacements[0];
  const second = layout.componentPlacements[1];
  const directory = layout.directoryPlacements[0];
  const secondDirectory = layout.directoryPlacements[1];
  assert.ok(first && second && directory && secondDirectory);

  const invalids = [
    replaceComponent(layout, 0, { ...first, componentId: second.componentId }),
    replaceComponent(layout, 0, { ...first, contractIndex: 999 }),
    {
      ...layout,
      directoryPlacements: [
        { ...directory, type: '', requirement: '', binding: '' },
        ...layout.directoryPlacements.slice(1),
      ],
    },
    {
      ...layout,
      directoryPlacements: [
        { ...directory, annotationCode: second.annotationCode },
        { ...secondDirectory, annotationCode: first.annotationCode },
        ...layout.directoryPlacements.slice(2),
      ],
    },
  ] as const;
  const expected = [
    'component index ownership mismatch',
    'component contract index mismatch',
    'empty directory metadata',
    'directory annotation pair mismatch',
  ] as const;

  for (const [index, invalid] of invalids.entries()) {
    assert.equal(
      auditScreenGeometry(invalid).some((error) =>
        error.includes(expected[index] ?? 'unreachable'),
      ),
      true,
      expected[index],
    );
  }
});

test('should reject interactive targets smaller than forty-four pixels', () => {
  const layout = baseLayout();
  const interactiveIndex = layout.componentPlacements.findIndex(
    (placement) => placement.interactive,
  );
  assert.notEqual(interactiveIndex, -1);
  const interactive = layout.componentPlacements[interactiveIndex];
  assert.ok(interactive);

  const invalid = replaceComponent(layout, interactiveIndex, {
    ...interactive,
    rect: { ...interactive.rect, width: 43, height: 43 },
  });
  assert.equal(
    auditScreenGeometry(invalid).some((error) =>
      error.includes('interactive target under 44'),
    ),
    true,
  );
});

test('should require one primary action and one safe exit', () => {
  const layout = baseLayout();
  const withoutPrimary: TScreenLayout = {
    ...layout,
    primaryActionPlacement: null,
  };
  const withoutExit: TScreenLayout = {
    ...layout,
    safeExitPlacement: null,
  };

  assert.equal(
    auditScreenGeometry(withoutPrimary).some((error) =>
      error.includes('missing primary action'),
    ),
    true,
  );
  assert.equal(
    auditScreenGeometry(withoutExit).some((error) =>
      error.includes('missing safe exit'),
    ),
    true,
  );
});

test('should enforce exact action, interaction and state ownership contracts', () => {
  const layout = baseLayout();
  const first = layout.componentPlacements[0];
  const interactiveIndex = layout.componentPlacements.findIndex((item) =>
    /^[AF]/.test(item.componentId),
  );
  const interactive = layout.componentPlacements[interactiveIndex];
  const state = layout.statePlacements[0];
  assert.ok(
    first &&
      interactive &&
      state &&
      layout.primaryActionPlacement &&
      layout.safeExitPlacement,
  );

  const variants = [
    replaceComponent(layout, interactiveIndex, {
      ...interactive,
      interactive: false,
    }),
    replaceComponent(layout, 0, {
      ...first,
      visualRole: 'navigation',
      interactive: false,
    }),
    {
      ...layout,
      primaryActionPlacement: {
        ...layout.primaryActionPlacement,
        id: 'safe-exit',
      },
    },
    {
      ...layout,
      primaryActionPlacement: {
        ...layout.primaryActionPlacement,
        ownerId: 'zone:primary',
      },
    },
    {
      ...layout,
      primaryActionPlacement: {
        ...layout.primaryActionPlacement,
        componentId: first.componentId,
        ownerId: `component:${first.componentId}`,
      },
    },
    {
      ...layout,
      safeExitPlacement: {
        ...layout.safeExitPlacement,
        componentId: first.componentId,
      },
    },
    {
      ...layout,
      safeExitPlacement: {
        ...layout.safeExitPlacement,
        ownerId: 'zone:primary',
      },
    },
    {
      ...layout,
      statePlacements: [
        { ...state, index: 99 },
        ...layout.statePlacements.slice(1),
      ],
    },
  ] as const satisfies readonly TScreenLayout[];
  const expected = [
    'interactive component demoted',
    'interactive component demoted',
    'primary action id mismatch',
    'primary action owner mismatch',
    'primary action must belong to an existing footer component',
    'safe exit component mismatch',
    'safe exit owner mismatch',
    'state index mismatch',
  ] as const;

  for (const [index, invalid] of variants.entries()) {
    assert.equal(
      auditScreenGeometry(invalid).some((error) =>
        error.includes(expected[index] ?? 'unreachable'),
      ),
      true,
      expected[index],
    );
  }
});

test('should detect state-strip overflow and state duplication', () => {
  const layout = baseLayout();
  const state = layout.statePlacements[0];
  assert.ok(state);

  const overflow: TStatePlacement = {
    ...state,
    rect: { ...state.rect, y: 1430, height: 44 },
  };
  const invalid: TScreenLayout = {
    ...layout,
    statePlacements: [overflow, ...layout.statePlacements.slice(1), state],
  };
  const errors = auditScreenGeometry(invalid);

  assert.equal(
    errors.some((error) => error.includes('state strip overflow')),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes('state duplication')),
    true,
  );
});

test('should keep directory entries inside exactly four columns', () => {
  const layout = baseLayout();
  const entry = layout.directoryPlacements[0];
  assert.ok(entry);

  const invalidEntry: TDirectoryPlacement = { ...entry, column: 4 };
  const invalid: TScreenLayout = {
    ...layout,
    directoryPlacements: [invalidEntry, ...layout.directoryPlacements.slice(1)],
  };

  assert.equal(
    auditScreenGeometry(invalid).some((error) =>
      error.includes('outside four directory columns'),
    ),
    true,
  );

  const shifted: TScreenLayout = {
    ...layout,
    directoryPlacements: [
      { ...entry, rect: { ...entry.rect, x: entry.rect.x + 1 } },
      ...layout.directoryPlacements.slice(1),
    ],
  };
  assert.equal(
    auditScreenGeometry(shifted).some((error) =>
      error.includes('directory geometry mismatch'),
    ),
    true,
  );
});

test('should reject any high-fidelity directory zone, panel or text residue', () => {
  const highFidelity = layoutScreen(BASE_SCREEN, 'high-fidelity');
  const withZone: TScreenLayout = {
    ...highFidelity,
    zones: {
      ...highFidelity.zones,
      directory: layoutScreen(BASE_SCREEN, 'wireframe').zones.directory,
    },
  };
  assert.equal(
    auditScreenGeometry(withZone).some((error) =>
      error.includes('high-fidelity directory zone must be null'),
    ),
    true,
  );

  const wireframe = baseLayout();
  const directoryPanel = wireframe.scenePrimitives.find(
    (item) => item.id === 'zone:directory',
  );
  const directoryText = wireframe.scenePrimitives.find((item) =>
    item.id.startsWith('text:directory:'),
  );
  assert.ok(directoryPanel && directoryText);
  const withResidue: TScreenLayout = {
    ...highFidelity,
    scenePrimitives: [
      ...highFidelity.scenePrimitives,
      directoryPanel,
      directoryText,
    ],
  };
  const errors = auditScreenGeometry(withResidue);
  assert.equal(
    errors.some((error) => error.includes('unexpected scene primitive')),
    true,
  );
});

test('should reject any placement or primitive outside the desktop canvas', () => {
  const layout = baseLayout();
  const primitive = layout.scenePrimitives[0];
  assert.ok(primitive);

  const invalidPrimitive = {
    ...primitive,
    rect: { ...primitive.rect, x: -1 },
  } as TScenePrimitive;
  const invalid: TScreenLayout = {
    ...layout,
    scenePrimitives: [invalidPrimitive, ...layout.scenePrimitives.slice(1)],
  };

  assert.equal(
    auditScreenGeometry(invalid).some((error) =>
      error.includes('outside 1920×1440 canvas'),
    ),
    true,
  );
});

test('should reject all nine authoritative interactive demotions', () => {
  const probes = [
    ['MH-001', 'D03'],
    ['MH-008', 'D04'],
    ['MH-012', 'D01'],
    ['MH-020', 'D04'],
    ['MH-022', 'D05'],
    ['MH-029', 'D05'],
    ['MH-030', 'D06'],
    ['MH-036', 'D02'],
    ['MH-057', 'D04'],
  ] as const;

  for (const [code, componentId] of probes) {
    const screen = SCREEN_CONTRACTS.find((item) => item.code === code);
    assert.ok(screen);
    const layout = layoutScreen(screen, 'wireframe');
    const index = layout.componentPlacements.findIndex(
      (item) => item.componentId === componentId,
    );
    const placement = layout.componentPlacements[index];
    assert.ok(placement);
    assert.equal(
      placement.interactive,
      true,
      `${code}/${componentId}: fixture`,
    );

    const invalid = replaceComponent(layout, index, {
      ...placement,
      interactive: false,
    });
    assert.equal(
      auditScreenGeometry(invalid).some((error) =>
        error.includes('authoritative component semantic mismatch'),
      ),
      true,
      `${code}/${componentId}`,
    );
  }
});

test('should reject coordinated semantic mutations against the authoritative contract', () => {
  const layout = baseLayout();
  const label = layout.scenePrimitives.find(
    (item): item is Extract<TScenePrimitive, { kind: 'text' }> =>
      item.kind === 'text' && item.id.endsWith(':label'),
  );
  const state = layout.statePlacements[0];
  const directory = layout.directoryPlacements[0];
  const placeholder = layout.scenePrimitives.find(
    (item): item is Extract<TScenePrimitive, { kind: 'placeholder' }> =>
      item.kind === 'placeholder',
  );
  assert.ok(label && state && directory && placeholder);
  const componentId = placeholder.id.replace('placeholder:component:', '');
  const placementIndex = layout.componentPlacements.findIndex(
    (item) => item.componentId === componentId,
  );
  const placement = layout.componentPlacements[placementIndex];
  assert.ok(placement);
  const changedKind = placement.placeholderKind === 'video' ? 'chart' : 'video';

  const variants = [
    {
      layout: {
        ...layout,
        scenePrimitives: layout.scenePrimitives.map((item) =>
          item.id === label.id ? { ...label, text: 'Nhãn hiển thị sai' } : item,
        ),
      },
      expected: 'authoritative scene primitive semantic mismatch',
    },
    {
      layout: {
        ...layout,
        directoryPlacements: [
          { ...directory, binding: '`wrong.authority`' },
          ...layout.directoryPlacements.slice(1),
        ],
      },
      expected: 'authoritative directory semantic mismatch',
    },
    {
      layout: {
        ...layout,
        statePlacements: [
          { ...state, displayLabel: 'Nhãn trạng thái sai' },
          ...layout.statePlacements.slice(1),
        ],
      },
      expected: 'authoritative state semantic mismatch',
    },
    {
      layout: {
        ...replaceComponent(layout, placementIndex, {
          ...placement,
          visualRole: 'content',
          placeholderKind: changedKind,
        }),
        scenePrimitives: layout.scenePrimitives.map((item) =>
          item.id === placeholder.id
            ? { ...placeholder, placeholderKind: changedKind }
            : item,
        ),
      },
      expected: 'authoritative component semantic mismatch',
    },
  ] as const satisfies readonly Readonly<{
    layout: TScreenLayout;
    expected: string;
  }>[];

  for (const variant of variants) {
    assert.equal(
      auditScreenGeometry(variant.layout).some((error) =>
        error.includes(variant.expected),
      ),
      true,
      variant.expected,
    );
  }
});

test('should reject unknown screen, fidelity and recipe authority', () => {
  const layout = baseLayout();
  const variants = [
    {
      layout: {
        ...layout,
        screenCode: 'MH-999' as TScreenLayout['screenCode'],
      },
      expected: 'unknown authoritative screen',
    },
    {
      layout: {
        ...layout,
        fidelity: 'print' as TScreenLayout['fidelity'],
      },
      expected: 'unknown authoritative fidelity',
    },
    {
      layout: { ...layout, recipe: 'form' as const },
      expected: 'authoritative recipe mismatch',
    },
  ] as const satisfies readonly Readonly<{
    layout: TScreenLayout;
    expected: string;
  }>[];

  for (const variant of variants) {
    assert.equal(
      auditScreenGeometry(variant.layout).some((error) =>
        error.includes(variant.expected),
      ),
      true,
      variant.expected,
    );
  }
});
