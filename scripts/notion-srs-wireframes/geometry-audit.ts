import {
  layoutScreen,
  measureVisibleText,
  wrapVisibleText,
} from './layout-recipes.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';

import type {
  TRect,
  TScenePrimitive,
  TScreenLayout,
  TTypographyPrimitive,
} from './types.ts';

type TGeometryNode = Readonly<{
  id: string;
  ownerId: string | null;
  rect: TRect;
}>;

type TExpectedPrimitive = Readonly<{
  kind: TScenePrimitive['kind'];
  ownerId?: string;
  role?: string;
  placeholderKind?: string;
}>;

const isPositiveRect = (rect: TRect): boolean =>
  Number.isFinite(rect.x) &&
  Number.isFinite(rect.y) &&
  Number.isFinite(rect.width) &&
  Number.isFinite(rect.height) &&
  rect.width > 0 &&
  rect.height > 0;

const contains = (owner: TRect, child: TRect): boolean =>
  child.x >= owner.x &&
  child.y >= owner.y &&
  child.x + child.width <= owner.x + owner.width &&
  child.y + child.height <= owner.y + owner.height;

const intersects = (left: TRect, right: TRect): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const rectEquals = (left: TRect, right: TRect): boolean =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const expectedDirectoryRect = (zone: TRect, index: number): TRect => {
  const columnGap = 8;
  const rowGap = 8;
  const cellWidth = Math.floor((zone.width - 24 - columnGap * 3) / 4);
  const cellHeight = 56;
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: zone.x + 12 + column * (cellWidth + columnGap),
    y: zone.y + 12 + row * (cellHeight + rowGap),
    width: cellWidth,
    height: cellHeight,
  };
};

const expectedScenePrimitives = (
  layout: TScreenLayout,
): ReadonlyMap<string, TExpectedPrimitive> => {
  const expected = new Map<string, TExpectedPrimitive>([
    ['zone:chrome', { kind: 'panel', role: 'chrome' }],
    ['zone:primary', { kind: 'panel', role: 'primary-canvas' }],
    ['zone:states', { kind: 'panel', role: 'state-strip' }],
    [
      'text:screen-title',
      { kind: 'text', ownerId: 'zone:chrome', role: 'screen-title' },
    ],
    [
      'text:screen-context',
      { kind: 'text', ownerId: 'zone:chrome', role: 'body' },
    ],
    [
      'text:safe-exit',
      { kind: 'text', ownerId: 'action:safe-exit', role: 'body' },
    ],
  ]);

  if (layout.fidelity === 'wireframe') {
    expected.set('zone:directory', {
      kind: 'panel',
      role: 'annotation-directory',
    });
  }

  for (const placement of layout.componentPlacements) {
    const ownerId = `component:${placement.componentId}`;
    expected.set(`text:component:${placement.componentId}:label`, {
      kind: 'text',
      ownerId,
      role: 'component-label',
    });
    expected.set(`text:component:${placement.componentId}:body`, {
      kind: 'text',
      ownerId,
      role: 'body',
    });
    if (placement.region !== 'footer' && placement.rect.height >= 112) {
      expected.set(`placeholder:component:${placement.componentId}`, {
        kind: 'placeholder',
        ownerId,
        placeholderKind: placement.placeholderKind,
      });
    }
  }

  if (layout.primaryActionPlacement) {
    expected.set('text:primary-action', {
      kind: 'text',
      ownerId: 'action:primary',
      role: 'body',
    });
  }
  for (const placement of layout.statePlacements) {
    expected.set(`text:state:${placement.index}`, {
      kind: 'text',
      ownerId: `state:${placement.index}`,
      role: 'annotation',
    });
  }
  if (layout.fidelity === 'wireframe') {
    for (const placement of layout.directoryPlacements) {
      for (let lineIndex = 0; lineIndex < 3; lineIndex += 1) {
        expected.set(`text:directory:${placement.componentId}:${lineIndex}`, {
          kind: 'text',
          ownerId: `directory:${placement.componentId}`,
          role: 'annotation',
        });
      }
    }
  }
  return expected;
};

const AUTHORITATIVE_LAYOUT_CACHE = new Map<string, TScreenLayout>();

const semanticEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const componentSemantic = (
  value: TScreenLayout['componentPlacements'][number],
) => ({
  componentId: value.componentId,
  annotationCode: value.annotationCode,
  contractIndex: value.contractIndex,
  region: value.region,
  interactive: value.interactive,
  visualRole: value.visualRole,
  placeholderKind: value.placeholderKind,
});

const actionSemantic = (value: TScreenLayout['primaryActionPlacement']) =>
  value
    ? {
        id: value.id,
        componentId: value.componentId,
        ownerId: value.ownerId,
        label: value.label,
        displayLabel: value.displayLabel,
        interactive: value.interactive,
      }
    : null;

const stateSemantic = (value: TScreenLayout['statePlacements'][number]) => ({
  state: value.state,
  displayLabel: value.displayLabel,
  index: value.index,
});

const directorySemantic = (
  value: TScreenLayout['directoryPlacements'][number],
) => ({
  componentId: value.componentId,
  annotationCode: value.annotationCode,
  type: value.type,
  requirement: value.requirement,
  binding: value.binding,
  column: value.column,
  row: value.row,
});

const primitiveSemantic = (value: TScenePrimitive): Readonly<object> => {
  if (value.kind === 'panel') {
    return {
      kind: value.kind,
      id: value.id,
      ownerId: value.ownerId ?? null,
      role: value.role,
    };
  }
  if (value.kind === 'text') {
    return {
      kind: value.kind,
      id: value.id,
      ownerId: value.ownerId,
      role: value.role,
      text: value.text,
      fontSize: value.fontSize,
      lineHeight: value.lineHeight,
      maxLines: value.maxLines,
    };
  }
  return {
    kind: value.kind,
    id: value.id,
    ownerId: value.ownerId,
    placeholderKind: value.placeholderKind,
    label: value.label,
  };
};

const compareSemanticArray = <TValue>(
  actual: readonly TValue[],
  expected: readonly TValue[],
  normalize: (value: TValue) => unknown,
  message: string,
): string[] => {
  const errors: string[] = [];
  if (actual.length !== expected.length) {
    errors.push(`${message}: count ${actual.length}!=${expected.length}`);
  }
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    const actualValue = actual[index];
    const expectedValue = expected[index];
    if (
      actualValue === undefined ||
      expectedValue === undefined ||
      !semanticEqual(normalize(actualValue), normalize(expectedValue))
    ) {
      errors.push(`${message}: index ${index}`);
    }
  }
  return errors;
};

const auditAuthoritativeSemantics = (layout: TScreenLayout): string[] => {
  const screen = SCREEN_CONTRACTS.find(
    (candidate) => candidate.code === layout.screenCode,
  );
  if (!screen) {
    return [`unknown authoritative screen: ${layout.screenCode}`];
  }
  if (layout.fidelity !== 'wireframe' && layout.fidelity !== 'high-fidelity') {
    return [`unknown authoritative fidelity: ${String(layout.fidelity)}`];
  }

  const cacheKey = `${screen.code}:${layout.fidelity}`;
  let expected = AUTHORITATIVE_LAYOUT_CACHE.get(cacheKey);
  if (!expected) {
    expected = layoutScreen(screen, layout.fidelity);
    AUTHORITATIVE_LAYOUT_CACHE.set(cacheKey, expected);
  }

  const errors: string[] = [];
  if (layout.recipe !== expected.recipe) {
    errors.push(
      `authoritative recipe mismatch: ${layout.recipe}!=${expected.recipe}`,
    );
  }
  if (
    !semanticEqual(layout.contractComponentIds, expected.contractComponentIds)
  ) {
    errors.push('authoritative contract component IDs mismatch');
  }
  if (!semanticEqual(layout.contractStates, expected.contractStates)) {
    errors.push('authoritative contract states mismatch');
  }
  errors.push(
    ...compareSemanticArray(
      layout.componentPlacements,
      expected.componentPlacements,
      componentSemantic,
      'authoritative component semantic mismatch',
    ),
  );
  if (
    !semanticEqual(
      actionSemantic(layout.primaryActionPlacement),
      actionSemantic(expected.primaryActionPlacement),
    )
  ) {
    errors.push('authoritative primary action semantic mismatch');
  }
  if (
    !semanticEqual(
      actionSemantic(layout.safeExitPlacement),
      actionSemantic(expected.safeExitPlacement),
    )
  ) {
    errors.push('authoritative safe exit semantic mismatch');
  }
  errors.push(
    ...compareSemanticArray(
      layout.statePlacements,
      expected.statePlacements,
      stateSemantic,
      'authoritative state semantic mismatch',
    ),
    ...compareSemanticArray(
      layout.directoryPlacements,
      expected.directoryPlacements,
      directorySemantic,
      'authoritative directory semantic mismatch',
    ),
    ...compareSemanticArray(
      layout.scenePrimitives,
      expected.scenePrimitives,
      primitiveSemantic,
      'authoritative scene primitive semantic mismatch',
    ),
  );
  return errors;
};

const duplicateValues = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const missingValues = (
  expected: readonly string[],
  actual: readonly string[],
): readonly string[] => {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
};

const unexpectedValues = (
  expected: readonly string[],
  actual: readonly string[],
): readonly string[] => {
  const expectedSet = new Set(expected);
  return actual.filter((value) => !expectedSet.has(value));
};

const isTextPrimitive = (
  primitive: TScenePrimitive,
): primitive is TTypographyPrimitive => primitive.kind === 'text';

const isAncestor = (
  possibleAncestorId: string,
  childId: string,
  nodeById: ReadonlyMap<string, TGeometryNode>,
): boolean => {
  const visited = new Set<string>();
  let ownerId = nodeById.get(childId)?.ownerId ?? null;

  while (ownerId) {
    if (ownerId === possibleAncestorId) return true;
    if (visited.has(ownerId)) return false;
    visited.add(ownerId);
    ownerId = nodeById.get(ownerId)?.ownerId ?? null;
  }
  return false;
};

const addNode = (
  node: TGeometryNode,
  nodes: TGeometryNode[],
  nodeById: Map<string, TGeometryNode>,
  errors: string[],
): void => {
  if (nodeById.has(node.id)) {
    errors.push(`geometry node duplication: ${node.id}`);
    return;
  }
  nodes.push(node);
  nodeById.set(node.id, node);
};

export const auditScreenGeometry = (layout: TScreenLayout): string[] => {
  const errors = auditAuthoritativeSemantics(layout);
  const canvas = {
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
  } as const;
  const nodes: TGeometryNode[] = [];
  const nodeById = new Map<string, TGeometryNode>();

  if (layout.width !== 1920 || layout.height !== 1440) {
    errors.push(
      `canvas must be 1920×1440, found ${layout.width}×${layout.height}`,
    );
  }
  if (layout.fidelity === 'wireframe' && layout.zones.directory === null) {
    errors.push('wireframe directory zone is required');
  }
  if (layout.fidelity === 'high-fidelity' && layout.zones.directory !== null) {
    errors.push('high-fidelity directory zone must be null');
  }

  for (const [zoneName, rect] of Object.entries(layout.zones)) {
    if (!rect) continue;
    addNode(
      { id: `zone:${zoneName}`, ownerId: null, rect },
      nodes,
      nodeById,
      errors,
    );
  }

  const componentIds = layout.componentPlacements.map(
    (placement) => placement.componentId,
  );
  const duplicateComponents = duplicateValues(componentIds);
  if (duplicateComponents.length > 0) {
    errors.push(
      `component ownership duplication: ${duplicateComponents.join(', ')}`,
    );
  }
  const missingComponents = missingValues(
    layout.contractComponentIds,
    componentIds,
  );
  if (missingComponents.length > 0) {
    errors.push(`component ownership loss: ${missingComponents.join(', ')}`);
  }
  const extraComponents = unexpectedValues(
    layout.contractComponentIds,
    componentIds,
  );
  if (extraComponents.length > 0) {
    errors.push(
      `unexpected component ownership: ${extraComponents.join(', ')}`,
    );
  }
  if (
    componentIds.join('\u0000') !== layout.contractComponentIds.join('\u0000')
  ) {
    errors.push('component placement order differs from contract order');
  }
  const annotationCodes = layout.componentPlacements.map(
    (placement) => placement.annotationCode,
  );
  const duplicateAnnotations = duplicateValues(annotationCodes);
  if (duplicateAnnotations.length > 0) {
    errors.push(
      `annotation ownership duplication: ${duplicateAnnotations.join(', ')}`,
    );
  }
  const missingAnnotations = missingValues(
    layout.contractComponentIds,
    annotationCodes,
  );
  if (missingAnnotations.length > 0) {
    errors.push(`annotation ownership loss: ${missingAnnotations.join(', ')}`);
  }
  const unexpectedAnnotations = unexpectedValues(
    layout.contractComponentIds,
    annotationCodes,
  );
  if (unexpectedAnnotations.length > 0) {
    errors.push(
      `unexpected annotation ownership: ${unexpectedAnnotations.join(', ')}`,
    );
  }

  for (const [index, placement] of layout.componentPlacements.entries()) {
    const expectedComponentId = layout.contractComponentIds[index];
    if (placement.contractIndex !== index) {
      errors.push(
        `component contract index mismatch: ${placement.componentId}/${placement.contractIndex}!=${index}`,
      );
    }
    if (placement.componentId !== expectedComponentId) {
      errors.push(
        `component index ownership mismatch: ${placement.componentId}!=${expectedComponentId ?? 'missing'}`,
      );
    }
    if (placement.annotationCode !== placement.componentId) {
      errors.push(
        `component annotation pair mismatch: ${placement.componentId}/${placement.annotationCode}`,
      );
    }
    addNode(
      {
        id: `component:${placement.componentId}`,
        ownerId: 'zone:primary',
        rect: placement.rect,
      },
      nodes,
      nodeById,
      errors,
    );
    const mustBeInteractive =
      /^[AF]/.test(placement.componentId) ||
      placement.visualRole === 'field' ||
      placement.visualRole === 'action' ||
      placement.visualRole === 'navigation';
    if (mustBeInteractive && !placement.interactive) {
      errors.push(`interactive component demoted: ${placement.componentId}`);
    }
    if (
      (placement.interactive || mustBeInteractive) &&
      (placement.rect.width < 44 || placement.rect.height < 44)
    ) {
      errors.push(
        `interactive target under 44: component:${placement.componentId}`,
      );
    }
  }

  if (!layout.primaryActionPlacement) {
    errors.push('missing primary action');
  } else {
    if (layout.primaryActionPlacement.id !== 'primary-action') {
      errors.push(
        `primary action id mismatch: ${layout.primaryActionPlacement.id}`,
      );
    }
    if (layout.primaryActionPlacement.interactive !== true) {
      errors.push('primary action must be interactive');
    }
    if (
      layout.primaryActionPlacement.label.trim().length === 0 ||
      layout.primaryActionPlacement.displayLabel.trim().length === 0
    ) {
      errors.push('primary action label must be nonempty');
    }
    const componentId = layout.primaryActionPlacement.componentId;
    const ownerPlacement = componentId
      ? layout.componentPlacements.find(
          (placement) => placement.componentId === componentId,
        )
      : undefined;
    if (!componentId || !ownerPlacement || ownerPlacement.region !== 'footer') {
      errors.push('primary action must belong to an existing footer component');
    }
    if (
      !componentId ||
      layout.primaryActionPlacement.ownerId !== `component:${componentId}`
    ) {
      errors.push(
        `primary action owner mismatch: ${layout.primaryActionPlacement.ownerId}`,
      );
    }
    addNode(
      {
        id: 'action:primary',
        ownerId: layout.primaryActionPlacement.ownerId,
        rect: layout.primaryActionPlacement.rect,
      },
      nodes,
      nodeById,
      errors,
    );
    if (
      layout.primaryActionPlacement.rect.width < 44 ||
      layout.primaryActionPlacement.rect.height < 44
    ) {
      errors.push('interactive target under 44: action:primary');
    }
  }

  if (!layout.safeExitPlacement) {
    errors.push('missing safe exit');
  } else {
    if (layout.safeExitPlacement.id !== 'safe-exit') {
      errors.push(`safe exit id mismatch: ${layout.safeExitPlacement.id}`);
    }
    if (layout.safeExitPlacement.interactive !== true) {
      errors.push('safe exit must be interactive');
    }
    if (
      layout.safeExitPlacement.label.trim().length === 0 ||
      layout.safeExitPlacement.displayLabel.trim().length === 0
    ) {
      errors.push('safe exit label must be nonempty');
    }
    if (layout.safeExitPlacement.componentId !== null) {
      errors.push('safe exit component mismatch: expected null');
    }
    if (layout.safeExitPlacement.ownerId !== 'zone:chrome') {
      errors.push(
        `safe exit owner mismatch: ${layout.safeExitPlacement.ownerId}`,
      );
    }
    addNode(
      {
        id: 'action:safe-exit',
        ownerId: layout.safeExitPlacement.ownerId,
        rect: layout.safeExitPlacement.rect,
      },
      nodes,
      nodeById,
      errors,
    );
    if (
      layout.safeExitPlacement.rect.width < 44 ||
      layout.safeExitPlacement.rect.height < 44
    ) {
      errors.push('interactive target under 44: action:safe-exit');
    }
  }

  const stateValues = layout.statePlacements.map(
    (placement) => placement.state,
  );
  const duplicateStates = duplicateValues(stateValues);
  if (duplicateStates.length > 0) {
    errors.push(`state duplication: ${duplicateStates.join(', ')}`);
  }
  const missingStates = missingValues(layout.contractStates, stateValues);
  if (missingStates.length > 0) {
    errors.push(`state loss: ${missingStates.join(', ')}`);
  }
  const extraStates = unexpectedValues(layout.contractStates, stateValues);
  if (extraStates.length > 0) {
    errors.push(`unexpected state: ${extraStates.join(', ')}`);
  }
  if (stateValues.join('\u0000') !== layout.contractStates.join('\u0000')) {
    errors.push('state placement order differs from contract order');
  }

  const stateZone = layout.zones.states;
  for (const [index, placement] of layout.statePlacements.entries()) {
    if (placement.index !== index) {
      errors.push(
        `state index mismatch: ${placement.state}/${placement.index}!=${index}`,
      );
    }
    if (placement.displayLabel.trim().length === 0) {
      errors.push(`empty state label: ${placement.state}`);
    }
    addNode(
      {
        id: `state:${placement.index}`,
        ownerId: 'zone:states',
        rect: placement.rect,
      },
      nodes,
      nodeById,
      errors,
    );
    if (!stateZone || !contains(stateZone, placement.rect)) {
      errors.push(`state strip overflow: ${placement.state}`);
    }
  }

  const directoryIds = layout.directoryPlacements.map(
    (placement) => placement.componentId,
  );
  const directoryAnnotationCodes = layout.directoryPlacements.map(
    (placement) => placement.annotationCode,
  );
  if (layout.fidelity === 'wireframe') {
    const duplicateDirectory = duplicateValues(directoryIds);
    if (duplicateDirectory.length > 0) {
      errors.push(
        `directory ownership duplication: ${duplicateDirectory.join(', ')}`,
      );
    }
    const missingDirectory = missingValues(
      layout.contractComponentIds,
      directoryIds,
    );
    if (missingDirectory.length > 0) {
      errors.push(`directory ownership loss: ${missingDirectory.join(', ')}`);
    }
    const extraDirectory = unexpectedValues(
      layout.contractComponentIds,
      directoryIds,
    );
    if (extraDirectory.length > 0) {
      errors.push(
        `unexpected directory ownership: ${extraDirectory.join(', ')}`,
      );
    }
    if (
      directoryIds.join('\u0000') !== layout.contractComponentIds.join('\u0000')
    ) {
      errors.push('directory order differs from contract order');
    }
    if (
      directoryAnnotationCodes.join('\u0000') !==
      layout.contractComponentIds.join('\u0000')
    ) {
      errors.push('directory annotation order differs from contract order');
    }
    const duplicateDirectoryAnnotations = duplicateValues(
      directoryAnnotationCodes,
    );
    if (duplicateDirectoryAnnotations.length > 0) {
      errors.push(
        `directory annotation ownership duplication: ${duplicateDirectoryAnnotations.join(', ')}`,
      );
    }
    const missingDirectoryAnnotations = missingValues(
      layout.contractComponentIds,
      directoryAnnotationCodes,
    );
    if (missingDirectoryAnnotations.length > 0) {
      errors.push(
        `directory annotation ownership loss: ${missingDirectoryAnnotations.join(', ')}`,
      );
    }
    const unexpectedDirectoryAnnotations = unexpectedValues(
      layout.contractComponentIds,
      directoryAnnotationCodes,
    );
    if (unexpectedDirectoryAnnotations.length > 0) {
      errors.push(
        `unexpected directory annotation ownership: ${unexpectedDirectoryAnnotations.join(', ')}`,
      );
    }
  } else if (directoryIds.length > 0) {
    errors.push(
      'high-fidelity layout must not contain an annotation directory',
    );
  }

  const directoryZone = layout.zones.directory;
  for (const [index, placement] of layout.directoryPlacements.entries()) {
    if (placement.annotationCode !== placement.componentId) {
      errors.push(
        `directory annotation pair mismatch: ${placement.componentId}/${placement.annotationCode}`,
      );
    }
    if (
      placement.type.trim().length === 0 ||
      placement.requirement.trim().length === 0 ||
      placement.binding.trim().length === 0
    ) {
      errors.push(`empty directory metadata: ${placement.componentId}`);
    }
    addNode(
      {
        id: `directory:${placement.componentId}`,
        ownerId: 'zone:directory',
        rect: placement.rect,
      },
      nodes,
      nodeById,
      errors,
    );
    if (
      !Number.isInteger(placement.column) ||
      placement.column < 0 ||
      placement.column > 3 ||
      placement.column !== index % 4
    ) {
      errors.push(
        `outside four directory columns: ${placement.componentId}/column=${placement.column}`,
      );
    }
    if (
      !Number.isInteger(placement.row) ||
      placement.row < 0 ||
      placement.row > 2 ||
      placement.row !== Math.floor(index / 4)
    ) {
      errors.push(
        `directory row overflow: ${placement.componentId}/row=${placement.row}`,
      );
    }
    if (!directoryZone || !contains(directoryZone, placement.rect)) {
      errors.push(`directory bounds overflow: ${placement.componentId}`);
    } else if (
      !rectEquals(placement.rect, expectedDirectoryRect(directoryZone, index))
    ) {
      errors.push(`directory geometry mismatch: ${placement.componentId}`);
    }
  }

  const primitiveIds = layout.scenePrimitives.map((primitive) => primitive.id);
  const duplicatePrimitives = duplicateValues(primitiveIds);
  if (duplicatePrimitives.length > 0) {
    errors.push(
      `scene primitive duplication: ${duplicatePrimitives.join(', ')}`,
    );
  }

  const expectedPrimitives = expectedScenePrimitives(layout);
  const actualPrimitiveById = new Map(
    layout.scenePrimitives.map((primitive) => [primitive.id, primitive]),
  );
  for (const [id, expected] of expectedPrimitives) {
    const primitive = actualPrimitiveById.get(id);
    if (!primitive) {
      errors.push(`missing scene primitive: ${id}`);
      continue;
    }
    if (primitive.kind !== expected.kind) {
      errors.push(
        `scene primitive kind mismatch: ${id}/${primitive.kind}!=${expected.kind}`,
      );
      continue;
    }
    if (
      expected.ownerId !== undefined &&
      primitive.kind !== 'panel' &&
      primitive.ownerId !== expected.ownerId
    ) {
      errors.push(
        `scene primitive owner mismatch: ${id}/${primitive.ownerId}!=${expected.ownerId}`,
      );
    }
    if (
      expected.role !== undefined &&
      'role' in primitive &&
      primitive.role !== expected.role
    ) {
      errors.push(
        `scene primitive role mismatch: ${id}/${primitive.role}!=${expected.role}`,
      );
    }
    if (
      primitive.kind === 'placeholder' &&
      expected.placeholderKind !== undefined &&
      primitive.placeholderKind !== expected.placeholderKind
    ) {
      errors.push(
        `placeholder kind mismatch: ${id}/${primitive.placeholderKind}!=${expected.placeholderKind}`,
      );
    }
  }
  for (const primitive of layout.scenePrimitives) {
    if (!expectedPrimitives.has(primitive.id)) {
      errors.push(`unexpected scene primitive: ${primitive.id}`);
    }
    if (
      primitive.kind === 'placeholder' &&
      primitive.label.trim().length === 0
    ) {
      errors.push(`empty placeholder label: ${primitive.id}`);
    }
  }

  for (const primitive of layout.scenePrimitives) {
    if (primitive.kind === 'panel') {
      const expectedZone = nodeById.get(primitive.id);
      if (!isPositiveRect(primitive.rect)) {
        errors.push(`invalid rectangle: primitive:${primitive.id}`);
      } else if (!contains(canvas, primitive.rect)) {
        errors.push(`outside 1920×1440 canvas: primitive:${primitive.id}`);
      }
      if (!expectedZone) {
        errors.push(`panel has no declared zone: ${primitive.id}`);
      } else if (
        expectedZone.rect.x !== primitive.rect.x ||
        expectedZone.rect.y !== primitive.rect.y ||
        expectedZone.rect.width !== primitive.rect.width ||
        expectedZone.rect.height !== primitive.rect.height
      ) {
        errors.push(`panel differs from declared zone: ${primitive.id}`);
      }
      continue;
    }

    addNode(
      {
        id: `primitive:${primitive.id}`,
        ownerId: primitive.ownerId,
        rect: primitive.rect,
      },
      nodes,
      nodeById,
      errors,
    );

    const owner = nodeById.get(primitive.ownerId);
    if (!owner || !contains(owner.rect, primitive.rect)) {
      errors.push(
        `${isTextPrimitive(primitive) ? 'text bounds leave owner' : 'placeholder bounds leave owner'}: ${primitive.id}`,
      );
    }

    if (isTextPrimitive(primitive)) {
      const finiteMetrics = [
        primitive.fontSize,
        primitive.lineHeight,
        primitive.maxLines,
        primitive.rect.x,
        primitive.rect.y,
        primitive.rect.width,
        primitive.rect.height,
      ].every(Number.isFinite);
      if (
        !finiteMetrics ||
        primitive.fontSize <= 0 ||
        primitive.lineHeight <= 0 ||
        !Number.isInteger(primitive.maxLines) ||
        primitive.maxLines < 1 ||
        primitive.rect.width <= 0 ||
        primitive.rect.height <= 0
      ) {
        errors.push(`non-finite text metrics: ${primitive.id}`);
        continue;
      }
      if (primitive.text.trim().length === 0) {
        errors.push(`empty visible text: ${primitive.id}`);
      }
      if (primitive.text.length >= 10_000) {
        errors.push(`excessive visible text: ${primitive.id}`);
      }
      if (primitive.role === 'annotation' && primitive.fontSize < 14) {
        errors.push(`annotation font under 14: ${primitive.id}`);
      }
      if (primitive.role !== 'annotation' && primitive.fontSize < 16) {
        errors.push(`body font under 16: ${primitive.id}`);
      }
      if (primitive.lineHeight < primitive.fontSize) {
        errors.push(`invalid text metrics: ${primitive.id}`);
      }

      try {
        const lines = wrapVisibleText(
          primitive.text,
          primitive.rect.width,
          primitive.fontSize,
        );
        if (lines.length > primitive.maxLines) {
          errors.push(`wrapped line count exceeds maxLines: ${primitive.id}`);
        }
        if (primitive.rect.height < lines.length * primitive.lineHeight) {
          errors.push(`text height below wrapped content: ${primitive.id}`);
        }
        if (
          lines.some(
            (line) =>
              measureVisibleText(line, primitive.fontSize) >
              primitive.rect.width,
          )
        ) {
          errors.push(`visible text line exceeds width: ${primitive.id}`);
        }
      } catch {
        errors.push(`visible text line exceeds width: ${primitive.id}`);
      }
    }
  }

  for (const node of nodes) {
    if (!isPositiveRect(node.rect)) {
      errors.push(`invalid rectangle: ${node.id}`);
      continue;
    }
    if (!contains(canvas, node.rect)) {
      errors.push(`outside 1920×1440 canvas: ${node.id}`);
    }
    if (node.ownerId) {
      const owner = nodeById.get(node.ownerId);
      if (!owner) {
        errors.push(`unknown geometry owner ${node.ownerId}: ${node.id}`);
      } else if (!contains(owner.rect, node.rect)) {
        errors.push(`declared containment failure ${node.ownerId}: ${node.id}`);
      }
    }
  }

  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    const left = nodes[leftIndex];
    if (!left) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < nodes.length;
      rightIndex += 1
    ) {
      const right = nodes[rightIndex];
      if (!right || !intersects(left.rect, right.rect)) continue;
      if (
        isAncestor(left.id, right.id, nodeById) ||
        isAncestor(right.id, left.id, nodeById)
      ) {
        continue;
      }
      errors.push(
        `rectangle overlap outside containment: ${left.id} <> ${right.id}`,
      );
    }
  }

  return errors;
};
