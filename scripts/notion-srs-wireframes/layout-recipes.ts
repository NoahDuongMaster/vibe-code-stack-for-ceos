import { SCREEN_STATE_LABELS } from './screen-contracts.ts';

import type {
  TActionPlacement,
  TComponentPlacement,
  TDirectoryPlacement,
  TLayoutRecipe,
  TLayoutZones,
  TPlaceholderKind,
  TRect,
  TScenePrimitive,
  TScreenComponent,
  TScreenContract,
  TScreenLayout,
  TScreenState,
  TStatePlacement,
  TVisualFidelity,
} from './types.ts';

export const SCREEN_CANVAS = Object.freeze({ width: 1920, height: 1440 });

export const WIREFRAME_ZONES = Object.freeze({
  chrome: Object.freeze({ x: 32, y: 24, width: 1856, height: 88 }),
  primary: Object.freeze({ x: 32, y: 128, width: 1856, height: 900 }),
  states: Object.freeze({ x: 32, y: 1044, width: 1856, height: 140 }),
  directory: Object.freeze({ x: 32, y: 1200, width: 1856, height: 208 }),
});

export const HIGH_FIDELITY_ZONES = Object.freeze({
  chrome: WIREFRAME_ZONES.chrome,
  primary: Object.freeze({ x: 32, y: 128, width: 1856, height: 1064 }),
  states: Object.freeze({ x: 32, y: 1208, width: 1856, height: 200 }),
  directory: null,
});

type TRecipeConfiguration = Readonly<{
  columns: 1 | 2 | 3;
  columnRatios: readonly number[];
  placeholderKind: TPlaceholderKind;
}>;

export type TLayoutRecipeBuilder = (
  screen: TScreenContract,
  zone: TRect,
) => readonly TComponentPlacement[];

const INNER_PADDING = 16;
const GRID_GAP = 12;
const HEADER_HEIGHT = 96;
const FOOTER_HEIGHT = 68;

const normalizedCharacter = (value: string): string =>
  value === 'Đ' ? 'D' : value === 'đ' ? 'd' : value;

const glyphWidthFactor = (value: string): number => {
  if (/\p{Mark}/u.test(value)) return 0;
  const glyph = normalizedCharacter(value);
  if (/\s/u.test(glyph)) return 0.3;
  if (/[ilIjtfr1|]/u.test(glyph)) return 0.31;
  if (/[mwMW@%&]/u.test(glyph)) return 0.82;
  if (/[A-Z0-9]/u.test(glyph)) return 0.6;
  if (/[a-z]/u.test(glyph)) return 0.52;
  if (/[-_.,:;!'"`/\\*()[\]{}]/u.test(glyph)) return 0.32;
  if (/[→←↑↓①-⑳]/u.test(glyph)) return 0.92;
  return 0.64;
};

export const measureVisibleText = (value: string, fontSize: number): number => {
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new Error('fontSize must be a positive finite number');
  }
  const units = Array.from(value.normalize('NFD')).reduce(
    (total, character) => total + glyphWidthFactor(character),
    0,
  );
  return Math.round(units * fontSize * 1000) / 1000;
};

const isPreferredBreak = (value: string): boolean => /[\s/._:*-]/u.test(value);

export const wrapVisibleText = (
  value: string,
  maxWidth: number,
  fontSize: number,
): string[] => {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    throw new Error('maxWidth must be a positive finite number');
  }
  if (value.length === 0) return [''];

  const remaining = Array.from(value);
  const lines: string[] = [];
  while (remaining.length > 0) {
    let acceptedCount = 0;
    let preferredBreak = 0;
    let candidate = '';
    for (const character of remaining) {
      const next = `${candidate}${character}`;
      if (measureVisibleText(next, fontSize) > maxWidth) break;
      candidate = next;
      acceptedCount += 1;
      if (isPreferredBreak(character)) preferredBreak = acceptedCount;
    }
    if (acceptedCount === 0) {
      throw new Error(
        `single visible glyph exceeds ${maxWidth}px at ${fontSize}px`,
      );
    }
    const take =
      acceptedCount === remaining.length || preferredBreak === 0
        ? acceptedCount
        : preferredBreak;
    lines.push(remaining.splice(0, take).join(''));
  }
  return lines;
};

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasTerm = (value: string, terms: readonly string[]): boolean =>
  terms.some((term) =>
    new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escapeRegularExpression(term)}(?:$|[^\\p{L}\\p{N}])`,
      'iu',
    ).test(value),
  );

const FIELD_TERMS = [
  'input',
  'select',
  'textarea',
  'checkbox',
  'switch',
  'picker',
  'upload',
  'ô nhập',
  'bộ chọn',
  'vùng văn bản',
  'hộp kiểm',
  'nhóm lựa chọn',
  'tải lên',
  'tải tệp',
  'công tắc',
] as const;

const ACTION_TERMS = ['button', 'nút', 'nhóm nút', 'hành động'] as const;

const NAVIGATION_TERMS = [
  'tab',
  'tabs',
  'menu',
  'accordion',
  'liên kết',
  'breadcrumb',
  'điều hướng',
] as const;

const STATUS_TERMS = [
  'trạng thái',
  'huy hiệu',
  'badge',
  'cảnh báo',
  'alert',
] as const;

const MEDIA_TERMS = [
  'video',
  'live',
  'trình phát',
  'hình ảnh',
  'ảnh đại diện',
  'avatar',
  'banner',
  'media',
  'phương tiện',
] as const;

const fitVisibleText = (
  value: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
): string => {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length === 0) return '—';

  const fits = (candidate: string): boolean => {
    try {
      const lines = wrapVisibleText(candidate, maxWidth, fontSize);
      return (
        lines.length <= maxLines &&
        lines.every((line) => measureVisibleText(line, fontSize) <= maxWidth)
      );
    } catch {
      return false;
    }
  };

  if (fits(normalized)) return normalized;

  const characters = Array.from(normalized);
  for (let length = characters.length - 1; length >= 0; length -= 1) {
    const candidate = `${characters.slice(0, length).join('').trimEnd()}…`;
    if (fits(candidate)) return candidate;
  }
  return '…';
};

const classifyVisualRole = (
  component: TScreenComponent,
): TComponentPlacement['visualRole'] => {
  const value =
    `${component.id} ${component.type} ${component.label}`.toLocaleLowerCase(
      'vi',
    );

  if (component.id.startsWith('A')) return 'action';
  if (component.id.startsWith('F')) return 'field';
  if (hasTerm(value, STATUS_TERMS)) return 'status';
  if (hasTerm(value, ACTION_TERMS)) return 'action';
  if (hasTerm(value, FIELD_TERMS)) return 'field';
  if (hasTerm(value, NAVIGATION_TERMS)) return 'navigation';
  if (hasTerm(value, MEDIA_TERMS)) return 'media';
  if (
    hasTerm(value, [
      'bằng chứng',
      'chứng cứ',
      'đồ thị',
      'graph',
      'timeline',
      'dòng thời gian',
    ])
  ) {
    return 'evidence';
  }
  return 'content';
};

const classifyPlaceholder = (
  component: TScreenComponent,
  visualRole: TComponentPlacement['visualRole'],
  fallback: TPlaceholderKind,
): TPlaceholderKind => {
  if (
    visualRole === 'field' ||
    visualRole === 'action' ||
    visualRole === 'navigation'
  ) {
    return 'form';
  }
  if (visualRole === 'status') return 'generic';

  const value = component.type.toLocaleLowerCase('vi');

  if (hasTerm(value, ['avatar', 'ảnh đại diện'])) return 'avatar';
  if (hasTerm(value, ['video', 'live', 'trình phát'])) return 'video';
  if (hasTerm(value, ['hình ảnh', 'banner', 'media', 'phương tiện']))
    return 'image';
  if (hasTerm(value, ['biểu đồ', 'chart'])) return 'chart';
  if (hasTerm(value, ['bảng', 'table', 'data grid', 'lưới dữ liệu']))
    return 'table';
  if (hasTerm(value, ['danh sách', 'list', 'directory', 'feed'])) return 'list';
  if (hasTerm(value, ['timeline', 'dòng thời gian'])) return 'timeline';
  if (hasTerm(value, ['sổ cái', 'ledger', 'ví', 'settlement', 'đối soát'])) {
    return 'ledger';
  }
  if (hasTerm(value, ['bằng chứng', 'chứng cứ', 'đồ thị', 'graph'])) {
    return 'evidence';
  }
  return fallback;
};

const isInteractive = (
  component: TScreenComponent,
  visualRole: TComponentPlacement['visualRole'],
): boolean => {
  const value = `${component.id} ${component.type}`.toLocaleLowerCase('vi');
  return (
    component.id.startsWith('A') ||
    component.id.startsWith('F') ||
    visualRole === 'field' ||
    visualRole === 'action' ||
    visualRole === 'navigation' ||
    hasTerm(value, [...FIELD_TERMS, ...ACTION_TERMS, ...NAVIGATION_TERMS])
  );
};

const distributeWidths = (
  availableWidth: number,
  ratios: readonly number[],
): readonly number[] => {
  const ratioTotal = ratios.reduce((sum, ratio) => sum + ratio, 0);
  let consumed = 0;

  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return availableWidth - consumed;
    const width = Math.floor((availableWidth * ratio) / ratioTotal);
    consumed += width;
    return width;
  });
};

const stackRects = (zone: TRect, count: number): readonly TRect[] => {
  if (count === 0) return [];

  const availableHeight = zone.height - GRID_GAP * (count - 1);
  const baseHeight = Math.floor(availableHeight / count);
  let y = zone.y;

  return Array.from({ length: count }, (_, index) => {
    const usedBeforeLast = baseHeight * (count - 1) + GRID_GAP * (count - 1);
    const height =
      index === count - 1 ? zone.height - usedBeforeLast : baseHeight;
    const rect = { x: zone.x, y, width: zone.width, height } as const;
    y += height + GRID_GAP;
    return rect;
  });
};

const buildRecipe = (
  screen: TScreenContract,
  zone: TRect,
  configuration: TRecipeConfiguration,
): readonly TComponentPlacement[] => {
  const header = screen.components.filter(
    (component) => component.region === 'header',
  );
  const footer = screen.components.filter(
    (component) => component.region === 'footer',
  );
  const content = screen.components.filter(
    (component) =>
      component.region !== 'header' && component.region !== 'footer',
  );
  const inner = {
    x: zone.x + INNER_PADDING,
    y: zone.y + INNER_PADDING,
    width: zone.width - INNER_PADDING * 2,
    height: zone.height - INNER_PADDING * 2,
  } as const;
  const headerReserve = header.length > 0 ? HEADER_HEIGHT + GRID_GAP : 0;
  const footerReserve = footer.length > 0 ? FOOTER_HEIGHT + GRID_GAP : 0;
  const contentZone = {
    x: inner.x,
    y: inner.y + headerReserve,
    width: inner.width,
    height: inner.height - headerReserve - footerReserve,
  } as const;

  const headerRects = stackRects(
    { ...inner, height: header.length > 0 ? HEADER_HEIGHT : 0 },
    header.length,
  );
  const footerRects = stackRects(
    {
      x: inner.x,
      y: inner.y + inner.height - FOOTER_HEIGHT,
      width: inner.width,
      height: footer.length > 0 ? FOOTER_HEIGHT : 0,
    },
    footer.length,
  );

  const laneGapTotal = GRID_GAP * (configuration.columns - 1);
  const laneWidths = distributeWidths(
    contentZone.width - laneGapTotal,
    configuration.columnRatios,
  );
  const laneX: number[] = [];
  let nextX = contentZone.x;
  for (const width of laneWidths) {
    laneX.push(nextX);
    nextX += width + GRID_GAP;
  }

  const hasDedicatedRightLane = content.some(
    (component) =>
      component.region === 'aside' || component.region === 'secondary',
  );
  const laneByComponent = new Map<TScreenComponent, number>();
  let primarySequence = 0;
  for (const component of content) {
    let lane = 0;
    if (configuration.columns > 1 && component.region === 'aside') {
      lane = configuration.columns - 1;
    } else if (configuration.columns > 1 && component.region === 'secondary') {
      lane = Math.min(1, configuration.columns - 1);
    } else if (!hasDedicatedRightLane && configuration.columns > 1) {
      lane = primarySequence % configuration.columns;
      primarySequence += 1;
    }
    laneByComponent.set(component, lane);
  }

  const rectByComponent = new Map<TScreenComponent, TRect>();
  for (const [index, component] of header.entries()) {
    const rect = headerRects[index];
    if (rect) rectByComponent.set(component, rect);
  }
  for (const [index, component] of footer.entries()) {
    const rect = footerRects[index];
    if (rect) rectByComponent.set(component, rect);
  }
  for (let lane = 0; lane < configuration.columns; lane += 1) {
    const laneComponents = content.filter(
      (component) => laneByComponent.get(component) === lane,
    );
    const x = laneX[lane];
    const width = laneWidths[lane];
    if (x === undefined || width === undefined) continue;

    const rects = stackRects(
      { x, y: contentZone.y, width, height: contentZone.height },
      laneComponents.length,
    );
    for (const [index, component] of laneComponents.entries()) {
      const rect = rects[index];
      if (rect) rectByComponent.set(component, rect);
    }
  }

  return screen.components.map((component, contractIndex) => {
    const rect = rectByComponent.get(component);
    if (!rect) {
      throw new Error(
        `${screen.code}/${component.id}: recipe did not allocate a rectangle`,
      );
    }

    const visualRole = classifyVisualRole(component);
    return Object.freeze({
      componentId: component.id,
      annotationCode: component.annotationCode,
      contractIndex,
      region: component.region,
      rect: Object.freeze(rect),
      interactive: isInteractive(component, visualRole),
      visualRole,
      placeholderKind: classifyPlaceholder(
        component,
        visualRole,
        configuration.placeholderKind,
      ),
    });
  });
};

export const layoutDashboard: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 3,
    columnRatios: [1, 1, 1],
    placeholderKind: 'chart',
  });

export const layoutForm: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 2,
    columnRatios: [0.62, 0.38],
    placeholderKind: 'form',
  });

export const layoutList: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 1,
    columnRatios: [1],
    placeholderKind: 'list',
  });

export const layoutDetail: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 2,
    columnRatios: [0.68, 0.32],
    placeholderKind: 'generic',
  });

export const layoutComposer: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 2,
    columnRatios: [0.64, 0.36],
    placeholderKind: 'form',
  });

export const layoutViewer: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 2,
    columnRatios: [0.7, 0.3],
    placeholderKind: 'video',
  });

export const layoutEvidence: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 2,
    columnRatios: [0.58, 0.42],
    placeholderKind: 'evidence',
  });

export const layoutReconciliation: TLayoutRecipeBuilder = (screen, zone) =>
  buildRecipe(screen, zone, {
    columns: 2,
    columnRatios: [0.76, 0.24],
    placeholderKind: 'ledger',
  });

export const LAYOUT_RECIPE_BUILDERS = Object.freeze({
  dashboard: layoutDashboard,
  form: layoutForm,
  list: layoutList,
  detail: layoutDetail,
  composer: layoutComposer,
  viewer: layoutViewer,
  evidence: layoutEvidence,
  reconciliation: layoutReconciliation,
} as const satisfies Readonly<Record<TLayoutRecipe, TLayoutRecipeBuilder>>);

const createStatePlacements = (
  states: readonly TScreenState[],
  zone: TRect,
): readonly TStatePlacement[] => {
  const columnCount = Math.min(10, Math.max(1, states.length));
  const rowCount = Math.ceil(states.length / 10);
  if (rowCount > 2) {
    throw new Error(
      `state strip supports at most 20 states, found ${states.length}`,
    );
  }

  const gap = 8;
  const innerX = zone.x + 12;
  const innerY = zone.y + 16;
  const availableWidth = zone.width - 24 - gap * (columnCount - 1);
  const cellWidth = Math.floor(availableWidth / columnCount);

  return states.map((state, index) =>
    Object.freeze({
      state,
      displayLabel: SCREEN_STATE_LABELS[state],
      index,
      rect: Object.freeze({
        x: innerX + (index % 10) * (cellWidth + gap),
        y: innerY + Math.floor(index / 10) * 56,
        width: cellWidth,
        height: 44,
      }),
    }),
  );
};

const createDirectoryPlacements = (
  screen: TScreenContract,
  zone: TRect | null,
): readonly TDirectoryPlacement[] => {
  if (!zone) return [];
  if (screen.components.length > 12) {
    throw new Error(
      `${screen.code}: four-column directory supports at most 12 entries`,
    );
  }

  const columnGap = 8;
  const rowGap = 8;
  const cellWidth = Math.floor((zone.width - 24 - columnGap * 3) / 4);
  const cellHeight = 56;

  return screen.components.map((component, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return Object.freeze({
      componentId: component.id,
      annotationCode: component.annotationCode,
      type: component.type,
      requirement: component.requirement,
      binding: component.binding,
      column,
      row,
      rect: Object.freeze({
        x: zone.x + 12 + column * (cellWidth + columnGap),
        y: zone.y + 12 + row * (cellHeight + rowGap),
        width: cellWidth,
        height: cellHeight,
      }),
    });
  });
};

const createPrimaryActionPlacement = (
  screen: TScreenContract,
  componentPlacements: readonly TComponentPlacement[],
): TActionPlacement | null => {
  const footerComponent = screen.components.find(
    (component) => component.region === 'footer',
  );
  if (!footerComponent) return null;
  const owner = componentPlacements.find(
    (placement) => placement.componentId === footerComponent.id,
  );
  if (!owner) return null;

  const width = Math.min(360, Math.max(240, owner.rect.width / 3));
  return Object.freeze({
    id: 'primary-action',
    componentId: owner.componentId,
    ownerId: `component:${owner.componentId}`,
    label: screen.primaryAction,
    displayLabel: screen.primaryAction,
    rect: Object.freeze({
      x: owner.rect.x + owner.rect.width - width - 12,
      y: owner.rect.y + Math.floor((owner.rect.height - 52) / 2),
      width,
      height: 52,
    }),
    interactive: true,
  });
};

const createSafeExitPlacement = (
  screen: TScreenContract,
  chrome: TRect,
): TActionPlacement =>
  Object.freeze({
    id: 'safe-exit',
    componentId: null,
    ownerId: 'zone:chrome',
    label: screen.safeExit,
    displayLabel: 'Quay lại an toàn',
    rect: Object.freeze({
      x: chrome.x + chrome.width - 296,
      y: chrome.y + 22,
      width: 280,
      height: 44,
    }),
    interactive: true,
  });

const createScenePrimitives = (
  screen: TScreenContract,
  zones: TLayoutZones,
  componentPlacements: readonly TComponentPlacement[],
  primaryActionPlacement: TActionPlacement | null,
  safeExitPlacement: TActionPlacement,
  statePlacements: readonly TStatePlacement[],
  directoryPlacements: readonly TDirectoryPlacement[],
): readonly TScenePrimitive[] => {
  const chrome = zones.chrome;
  const primary = zones.primary;
  const states = zones.states;
  if (!chrome || !primary || !states) {
    throw new Error(
      `${screen.code}: chrome, primary and states zones are required`,
    );
  }

  const primitives: TScenePrimitive[] = [
    {
      kind: 'panel',
      id: 'zone:chrome',
      role: 'chrome',
      rect: chrome,
    },
    {
      kind: 'panel',
      id: 'zone:primary',
      role: 'primary-canvas',
      rect: primary,
    },
    {
      kind: 'panel',
      id: 'zone:states',
      role: 'state-strip',
      rect: states,
    },
  ];

  if (zones.directory) {
    primitives.push({
      kind: 'panel',
      id: 'zone:directory',
      role: 'annotation-directory',
      rect: zones.directory,
    });
  }

  primitives.push(
    {
      kind: 'text',
      id: 'text:screen-title',
      ownerId: 'zone:chrome',
      role: 'screen-title',
      text: fitVisibleText(
        `${screen.code} — ${screen.displayTitle}`,
        chrome.width - 360,
        28,
        1,
      ),
      rect: {
        x: chrome.x + 24,
        y: chrome.y + 12,
        width: chrome.width - 360,
        height: 34,
      },
      fontSize: 28,
      lineHeight: 34,
      maxLines: 1,
    },
    {
      kind: 'text',
      id: 'text:screen-context',
      ownerId: 'zone:chrome',
      role: 'body',
      text: fitVisibleText(
        `${screen.actor} · ${screen.route}`,
        chrome.width - 360,
        16,
        1,
      ),
      rect: {
        x: chrome.x + 24,
        y: chrome.y + 52,
        width: chrome.width - 360,
        height: 24,
      },
      fontSize: 16,
      lineHeight: 22,
      maxLines: 1,
    },
    {
      kind: 'text',
      id: 'text:safe-exit',
      ownerId: 'action:safe-exit',
      role: 'body',
      text: fitVisibleText(
        safeExitPlacement.displayLabel,
        safeExitPlacement.rect.width - 24,
        16,
        1,
      ),
      rect: {
        x: safeExitPlacement.rect.x + 12,
        y: safeExitPlacement.rect.y + 11,
        width: safeExitPlacement.rect.width - 24,
        height: 22,
      },
      fontSize: 16,
      lineHeight: 22,
      maxLines: 1,
    },
  );

  for (const placement of componentPlacements) {
    const component = screen.components[placement.contractIndex];
    if (!component) continue;
    const actionReserve = placement.region === 'footer' ? 384 : 0;
    const textWidth = Math.max(80, placement.rect.width - 24 - actionReserve);
    const bodyHeight = placement.rect.height >= 84 ? 40 : 20;
    const bodyMaxLines = bodyHeight >= 40 ? 2 : 1;
    primitives.push(
      {
        kind: 'text',
        id: `text:component:${placement.componentId}:label`,
        ownerId: `component:${placement.componentId}`,
        role: 'component-label',
        text: fitVisibleText(
          `${placement.annotationCode} · ${component.label}`,
          textWidth,
          16,
          1,
        ),
        rect: {
          x: placement.rect.x + 12,
          y: placement.rect.y + 8,
          width: textWidth,
          height: 22,
        },
        fontSize: 16,
        lineHeight: 22,
        maxLines: 1,
      },
      {
        kind: 'text',
        id: `text:component:${placement.componentId}:body`,
        ownerId: `component:${placement.componentId}`,
        role: 'body',
        text: fitVisibleText(
          component.requirement,
          textWidth,
          16,
          bodyMaxLines,
        ),
        rect: {
          x: placement.rect.x + 12,
          y: placement.rect.y + 34,
          width: textWidth,
          height: bodyHeight,
        },
        fontSize: 16,
        lineHeight: 20,
        maxLines: bodyMaxLines,
      },
    );

    if (placement.region !== 'footer' && placement.rect.height >= 112) {
      primitives.push({
        kind: 'placeholder',
        id: `placeholder:component:${placement.componentId}`,
        ownerId: `component:${placement.componentId}`,
        placeholderKind: placement.placeholderKind,
        label: component.type,
        rect: {
          x: placement.rect.x + 12,
          y: placement.rect.y + 80,
          width: placement.rect.width - 24,
          height: placement.rect.height - 92,
        },
      });
    }
  }

  if (primaryActionPlacement) {
    primitives.push({
      kind: 'text',
      id: 'text:primary-action',
      ownerId: 'action:primary',
      role: 'body',
      text: fitVisibleText(
        primaryActionPlacement.displayLabel,
        primaryActionPlacement.rect.width - 24,
        16,
        2,
      ),
      rect: {
        x: primaryActionPlacement.rect.x + 12,
        y: primaryActionPlacement.rect.y + 6,
        width: primaryActionPlacement.rect.width - 24,
        height: 40,
      },
      fontSize: 16,
      lineHeight: 20,
      maxLines: 2,
    });
  }

  for (const placement of statePlacements) {
    primitives.push({
      kind: 'text',
      id: `text:state:${placement.index}`,
      ownerId: `state:${placement.index}`,
      role: 'annotation',
      text: fitVisibleText(
        placement.displayLabel,
        placement.rect.width - 16,
        14,
        2,
      ),
      rect: {
        x: placement.rect.x + 8,
        y: placement.rect.y + 4,
        width: placement.rect.width - 16,
        height: 36,
      },
      fontSize: 14,
      lineHeight: 18,
      maxLines: 2,
    });
  }

  for (const placement of directoryPlacements) {
    const ownerId = `directory:${placement.componentId}`;
    const lines = [
      `${placement.annotationCode} · ${placement.type}`,
      placement.requirement,
      placement.binding,
    ] as const;
    for (const [lineIndex, line] of lines.entries()) {
      primitives.push({
        kind: 'text',
        id: `text:directory:${placement.componentId}:${lineIndex}`,
        ownerId,
        role: 'annotation',
        text: fitVisibleText(line, placement.rect.width - 12, 14, 1),
        rect: {
          x: placement.rect.x + 6,
          y: placement.rect.y + 4 + lineIndex * 16,
          width: placement.rect.width - 12,
          height: 16,
        },
        fontSize: 14,
        lineHeight: 16,
        maxLines: 1,
      });
    }
  }

  return Object.freeze(
    primitives.map((primitive) =>
      Object.freeze({
        ...primitive,
        rect: Object.freeze({ ...primitive.rect }),
      }),
    ),
  );
};

export const layoutScreen = (
  screen: TScreenContract,
  fidelity: TVisualFidelity,
): TScreenLayout => {
  const sourceZones =
    fidelity === 'wireframe' ? WIREFRAME_ZONES : HIGH_FIDELITY_ZONES;
  const zones: TLayoutZones = Object.freeze({
    chrome: sourceZones.chrome,
    primary: sourceZones.primary,
    states: sourceZones.states,
    directory: sourceZones.directory,
  });
  const componentPlacements = LAYOUT_RECIPE_BUILDERS[screen.layoutRecipe](
    screen,
    sourceZones.primary,
  );
  const primaryActionPlacement = createPrimaryActionPlacement(
    screen,
    componentPlacements,
  );
  const safeExitPlacement = createSafeExitPlacement(screen, sourceZones.chrome);
  const statePlacements = createStatePlacements(
    screen.states,
    sourceZones.states,
  );
  const directoryPlacements = createDirectoryPlacements(
    screen,
    sourceZones.directory,
  );
  const scenePrimitives = createScenePrimitives(
    screen,
    zones,
    componentPlacements,
    primaryActionPlacement,
    safeExitPlacement,
    statePlacements,
    directoryPlacements,
  );

  return Object.freeze({
    screenCode: screen.code,
    recipe: screen.layoutRecipe,
    width: SCREEN_CANVAS.width,
    height: SCREEN_CANVAS.height,
    fidelity,
    zones,
    contractComponentIds: Object.freeze(
      screen.components.map((component) => component.id),
    ),
    contractStates: Object.freeze([...screen.states]),
    componentPlacements: Object.freeze([...componentPlacements]),
    primaryActionPlacement,
    safeExitPlacement,
    statePlacements: Object.freeze([...statePlacements]),
    directoryPlacements: Object.freeze([...directoryPlacements]),
    scenePrimitives,
  });
};
