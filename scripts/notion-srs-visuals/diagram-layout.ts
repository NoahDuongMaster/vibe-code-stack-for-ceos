import type {
  TDiagramEdge,
  TDiagramLayout,
  TDiagramSpec,
  TLayoutPath,
  TLayoutReference,
  TLayoutText,
  TPoint,
  TRect,
  TReferenceKind,
} from './types.ts';

const VIEWBOX = { width: 1400, height: 1800 } as const;

const TYPOGRAPHY = {
  title: 46,
  subtitle: 30,
  scope: 24,
  band: 30,
  column: 26,
  nodeTitle: 30,
  nodeDetail: 24,
  badge: 20,
  connector: 22,
  footer: 22,
} as const;

const BAND_RECTS = [
  { x: 48, y: 155, width: 1304, height: 690 },
  { x: 48, y: 900, width: 1304, height: 690 },
] as const;

const COLUMN_GAP = 48;
const NODE_GAP = 12;
const NODE_MIN_HEIGHT = 128;
const NODE_HORIZONTAL_PADDING = 14;
const NODE_VERTICAL_PADDING = 3;
const NODE_TEXT_GAP = 2;
const COLUMN_TITLE_TOP = 12;
const COLUMN_TITLE_LINE_HEIGHT = 32;
const NODE_AREA_TOP = 76;
const NODE_AREA_BOTTOM = 0;
const NODE_TITLE_LINE_HEIGHT = 34;
const NODE_DETAIL_LINE_HEIGHT = 28;
const CONNECTOR_LINE_HEIGHT = 28;
const REFERENCE_CHIP_HEIGHT = 30;
const REFERENCE_CHIP_WIDTH = 48;
const PATH_LABEL_HEIGHT = 28;
const PATH_LABEL_WIDTH = 32;
const PATH_LANE_STRIPE_WIDTH = COLUMN_GAP - PATH_LABEL_WIDTH;
const CONTROL_GAP = 6;
const CONTROL_ROW_GAP = 4;

type TBandIndex = 0 | 1;
type TPathKind = TLayoutPath['kind'];
type TEdgeClassification = TPathKind | TReferenceKind;
type TSide = 'left' | 'right';

type TNodeIndex = Readonly<{
  bandIndex: TBandIndex;
  columnIndex: number;
}>;

type TClassifiedEdge = Readonly<{
  edge: TDiagramEdge;
  kind: TEdgeClassification;
}>;

type TReferenceDescriptor = Readonly<{
  index: number;
  edge: TDiagramEdge;
  kind: TReferenceKind;
  code: string;
}>;

type TReferenceControl = Readonly<{
  kind: 'reference';
  referenceIndex: number;
  role: 'source' | 'target';
  code: string;
  width: number;
  height: number;
}>;

type TBadgeControl = Readonly<{
  kind: 'badge';
  text: string;
  width: number;
  height: number;
}>;

type TNodeControl = TReferenceControl | TBadgeControl;

type TControlRow = Readonly<{
  controls: readonly TNodeControl[];
  height: number;
}>;

const normalizedCharacter = (value: string): string =>
  value === 'Đ' ? 'D' : value === 'đ' ? 'd' : value;

const glyphWidthFactor = (value: string): number => {
  if (/\p{Mark}/u.test(value)) {
    return 0;
  }

  const glyph = normalizedCharacter(value);
  if (/\s/u.test(glyph)) {
    return 0.3;
  }
  if (/[ilIjtfr1|]/u.test(glyph)) {
    return 0.31;
  }
  if (/[mwMW@%&]/u.test(glyph)) {
    return 0.82;
  }
  if (/[A-Z0-9]/u.test(glyph)) {
    return 0.6;
  }
  if (/[a-z]/u.test(glyph)) {
    return 0.52;
  }
  if (/[-_.,:;!'"`/\\*()[\]{}]/u.test(glyph)) {
    return 0.32;
  }
  if (/[→←↑↓①-⑳]/u.test(glyph)) {
    return 0.92;
  }
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
  if (value.length === 0) {
    return [''];
  }

  const remaining = Array.from(value);
  const lines: string[] = [];

  while (remaining.length > 0) {
    let acceptedCount = 0;
    let preferredBreak = 0;
    let candidate = '';

    for (const character of remaining) {
      const next = `${candidate}${character}`;
      if (measureVisibleText(next, fontSize) > maxWidth) {
        break;
      }
      candidate = next;
      acceptedCount += 1;
      if (isPreferredBreak(character)) {
        preferredBreak = acceptedCount;
      }
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

const layoutText = (
  value: string,
  rect: Omit<TRect, 'height'>,
  fontSize: number,
  lineHeight: number,
  align: TLayoutText['align'] = 'start',
): TLayoutText => {
  const lines = wrapVisibleText(value, rect.width, fontSize);
  return {
    rect: { ...rect, height: lines.length * lineHeight },
    lines,
    fontSize,
    lineHeight,
    align,
  };
};

const bandColumnIndexes = (columnCount: number): readonly number[][] => {
  if (columnCount < 2) {
    throw new Error('layoutDiagram requires at least two columns');
  }
  if (columnCount > 5) {
    throw new Error('layoutDiagram does not support more than five columns');
  }

  const firstBandCount = columnCount === 5 ? 3 : Math.ceil(columnCount / 2);
  return [
    Array.from({ length: firstBandCount }, (_, index) => index),
    Array.from(
      { length: columnCount - firstBandCount },
      (_, index) => firstBandCount + index,
    ),
  ];
};

const classifyEdge = (
  edge: TDiagramEdge,
  from: TNodeIndex,
  to: TNodeIndex,
): TEdgeClassification => {
  if (edge.style === 'dotted') {
    return 'evidence';
  }

  const columnDelta = to.columnIndex - from.columnIndex;
  if (
    edge.style === 'dashed' &&
    (from.bandIndex !== to.bandIndex || columnDelta !== 1)
  ) {
    return 'async';
  }
  if (from.bandIndex !== to.bandIndex) {
    return 'handoff';
  }
  if (to.columnIndex < from.columnIndex) {
    return 'return';
  }
  if (columnDelta > 1) {
    return 'jump';
  }
  if (to.columnIndex === from.columnIndex) {
    return 'same-column-rail';
  }
  return 'forward-lane';
};

const requireNodeIndex = (
  nodeIndexes: ReadonlyMap<string, TNodeIndex>,
  nodeId: string,
  diagramKey: string,
): TNodeIndex => {
  const value = nodeIndexes.get(nodeId);
  if (!value) {
    throw new Error(`${diagramKey}: edge references unknown node ${nodeId}`);
  }
  return value;
};

const pointKey = (nodeId: string, side: TSide): string => `${nodeId}:${side}`;

const referenceCode = (kind: TReferenceKind, ordinal: number): string => {
  if (kind === 'handoff') {
    return ordinal <= 20
      ? String.fromCodePoint(0x245f + ordinal)
      : `H${ordinal}`;
  }
  if (kind === 'jump') {
    return `N${ordinal}`;
  }
  if (kind === 'return') {
    return `R${ordinal}`;
  }
  if (kind === 'evidence') {
    return `E${ordinal}`;
  }
  if (kind === 'same-column-reference') {
    return `S${ordinal}`;
  }
  return `A${ordinal}`;
};

const rectRight = (rect: TRect): number => rect.x + rect.width;
const rectBottom = (rect: TRect): number => rect.y + rect.height;

const rectanglesIntersect = (left: TRect, right: TRect): boolean =>
  left.x < rectRight(right) &&
  rectRight(left) > right.x &&
  left.y < rectBottom(right) &&
  rectBottom(left) > right.y;

const isAxisAligned = (segment: TLayoutPath['segments'][number]): boolean =>
  segment.from.x === segment.to.x || segment.from.y === segment.to.y;

const segmentsIntersect = (
  left: TLayoutPath['segments'][number],
  right: TLayoutPath['segments'][number],
): boolean => {
  if (!isAxisAligned(left) || !isAxisAligned(right)) {
    return false;
  }
  const leftHorizontal = left.from.y === left.to.y;
  const rightHorizontal = right.from.y === right.to.y;
  const leftMinimumX = Math.min(left.from.x, left.to.x);
  const leftMaximumX = Math.max(left.from.x, left.to.x);
  const leftMinimumY = Math.min(left.from.y, left.to.y);
  const leftMaximumY = Math.max(left.from.y, left.to.y);
  const rightMinimumX = Math.min(right.from.x, right.to.x);
  const rightMaximumX = Math.max(right.from.x, right.to.x);
  const rightMinimumY = Math.min(right.from.y, right.to.y);
  const rightMaximumY = Math.max(right.from.y, right.to.y);

  if (leftHorizontal && rightHorizontal) {
    return (
      left.from.y === right.from.y &&
      leftMaximumX >= rightMinimumX &&
      rightMaximumX >= leftMinimumX
    );
  }
  if (!leftHorizontal && !rightHorizontal) {
    return (
      left.from.x === right.from.x &&
      leftMaximumY >= rightMinimumY &&
      rightMaximumY >= leftMinimumY
    );
  }

  const horizontal = leftHorizontal ? left : right;
  const vertical = leftHorizontal ? right : left;
  return (
    vertical.from.x >= Math.min(horizontal.from.x, horizontal.to.x) &&
    vertical.from.x <= Math.max(horizontal.from.x, horizontal.to.x) &&
    horizontal.from.y >= Math.min(vertical.from.y, vertical.to.y) &&
    horizontal.from.y <= Math.max(vertical.from.y, vertical.to.y)
  );
};

const segmentIntersectsRectangle = (
  segment: TLayoutPath['segments'][number],
  rect: TRect,
): boolean => {
  if (segment.from.y === segment.to.y) {
    return (
      segment.from.y >= rect.y &&
      segment.from.y <= rectBottom(rect) &&
      Math.max(segment.from.x, segment.to.x) >= rect.x &&
      Math.min(segment.from.x, segment.to.x) <= rectRight(rect)
    );
  }
  return (
    segment.from.x >= rect.x &&
    segment.from.x <= rectRight(rect) &&
    Math.max(segment.from.y, segment.to.y) >= rect.y &&
    Math.min(segment.from.y, segment.to.y) <= rectBottom(rect)
  );
};

const permutations = <T>(values: readonly T[]): readonly T[][] => {
  if (values.length <= 1) {
    return [[...values]];
  }
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map(
      (remaining) => [value, ...remaining],
    ),
  );
};

const cartesianProduct = <T>(
  groups: readonly (readonly T[])[],
): readonly T[][] => {
  if (groups.length === 0) {
    return [[]];
  }
  const [first = [], ...remaining] = groups;
  return first.flatMap((value) =>
    cartesianProduct(remaining).map((tail) => [value, ...tail]),
  );
};

const anchorPoint = (
  rect: TRect,
  side: TSide,
  ordinal: number,
  total: number,
): TPoint => ({
  x: side === 'right' ? rectRight(rect) : rect.x,
  y: rect.y + ((ordinal + 1) * rect.height) / (total + 1),
});

const increment = (map: Map<string, number>, key: string): number => {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
};

const packControls = (
  controls: readonly TNodeControl[],
  availableWidth: number,
): readonly TControlRow[] => {
  const rows: {
    controls: TNodeControl[];
    height: number;
    width: number;
  }[] = [];

  for (const control of controls) {
    const current = rows.at(-1);
    const nextWidth = current
      ? current.width + CONTROL_GAP + control.width
      : control.width;
    const referenceCount =
      current?.controls.filter((item) => item.kind === 'reference').length ?? 0;
    if (
      !current ||
      nextWidth > availableWidth + 0.000_001 ||
      (control.kind === 'reference' && referenceCount >= 4)
    ) {
      rows.push({
        controls: [control],
        height: control.height,
        width: control.width,
      });
    } else {
      current.controls.push(control);
      current.height = Math.max(current.height, control.height);
      current.width = nextWidth;
    }
  }

  return rows.map(({ controls: rowControls, height }) => ({
    controls: rowControls,
    height,
  }));
};

const controlRowsHeight = (rows: readonly TControlRow[]): number =>
  rows.reduce((total, row) => total + row.height, 0) +
  Math.max(0, rows.length - 1) * CONTROL_ROW_GAP;

export const layoutDiagram = (spec: TDiagramSpec): TDiagramLayout => {
  const indexGroups = bandColumnIndexes(spec.columns.length);
  if (spec.edges.length > 24) {
    throw new Error(`${spec.key}: layout supports at most twenty-four edges`);
  }
  const bands = indexGroups.map((columnIndexes, index) => {
    if (columnIndexes.length > 3) {
      throw new Error(
        `${spec.key}: a band cannot contain more than three columns`,
      );
    }
    return {
      index: index as TBandIndex,
      columnIndexes,
      rect: BAND_RECTS[index as TBandIndex],
    };
  });

  const nodeIndexes = new Map<string, TNodeIndex>();
  for (const band of bands) {
    for (const columnIndex of band.columnIndexes) {
      const semanticColumn = spec.columns[columnIndex];
      if (
        !semanticColumn ||
        semanticColumn.nodes.length < 1 ||
        semanticColumn.nodes.length > 4
      ) {
        throw new Error(
          `${spec.key}: column ${columnIndex} must contain between one and four nodes`,
        );
      }
      for (const semanticNode of semanticColumn.nodes) {
        if (nodeIndexes.has(semanticNode.id)) {
          throw new Error(`${spec.key}: duplicate node ${semanticNode.id}`);
        }
        nodeIndexes.set(semanticNode.id, {
          bandIndex: band.index,
          columnIndex,
        });
      }
    }
  }

  const classifiedEdges: TClassifiedEdge[] = spec.edges.map((edge) => {
    const from = requireNodeIndex(nodeIndexes, edge.from, spec.key);
    const to = requireNodeIndex(nodeIndexes, edge.to, spec.key);
    return { edge, kind: classifyEdge(edge, from, to) };
  });
  const earlyLocalPathCounts = new Map<string, number>();
  for (const item of classifiedEdges) {
    if (item.kind !== 'forward-lane') {
      continue;
    }
    const from = requireNodeIndex(nodeIndexes, item.edge.from, spec.key);
    const gutterKey = `b${from.bandIndex}:g:${from.columnIndex}:${from.columnIndex + 1}`;
    if (increment(earlyLocalPathCounts, gutterKey) > 5) {
      throw new Error(
        `${spec.key}: ${gutterKey} supports at most five local paths per gutter`,
      );
    }
  }
  const visualNodesByColumn = new Map<
    number,
    TDiagramSpec['columns'][number]['nodes']
  >();
  for (const band of bands) {
    const permutationChoices = band.columnIndexes.map((columnIndex) => {
      const semanticColumn = spec.columns[columnIndex];
      if (!semanticColumn) {
        throw new Error(`${spec.key}: missing column ${columnIndex}`);
      }
      return semanticColumn.allowVisualReorder
        ? permutations(semanticColumn.nodes)
        : [[...semanticColumn.nodes]];
    });
    let bestScore = Number.POSITIVE_INFINITY;
    let bestCombination:
      | readonly TDiagramSpec['columns'][number]['nodes'][]
      | undefined;
    for (const combination of cartesianProduct(permutationChoices)) {
      const visualOrdinalByNodeId = new Map<string, number>();
      for (const nodesInColumn of combination) {
        for (const [ordinal, node] of nodesInColumn.entries()) {
          visualOrdinalByNodeId.set(node.id, ordinal);
        }
      }
      let score = 0;
      for (
        let boundaryIndex = 0;
        boundaryIndex < band.columnIndexes.length - 1;
        boundaryIndex += 1
      ) {
        const leftColumnIndex = band.columnIndexes[boundaryIndex];
        const rightColumnIndex = band.columnIndexes[boundaryIndex + 1];
        const boundaryEdges = classifiedEdges.filter((item) => {
          if (item.kind !== 'forward-lane') {
            return false;
          }
          const from = nodeIndexes.get(item.edge.from);
          const to = nodeIndexes.get(item.edge.to);
          return (
            from?.columnIndex === leftColumnIndex &&
            to?.columnIndex === rightColumnIndex
          );
        });
        for (
          let leftEdgeIndex = 0;
          leftEdgeIndex < boundaryEdges.length;
          leftEdgeIndex += 1
        ) {
          const leftEdge = boundaryEdges[leftEdgeIndex];
          if (!leftEdge) {
            continue;
          }
          for (
            let rightEdgeIndex = leftEdgeIndex + 1;
            rightEdgeIndex < boundaryEdges.length;
            rightEdgeIndex += 1
          ) {
            const rightEdge = boundaryEdges[rightEdgeIndex];
            if (!rightEdge) {
              continue;
            }
            const leftSource = visualOrdinalByNodeId.get(leftEdge.edge.from);
            const rightSource = visualOrdinalByNodeId.get(rightEdge.edge.from);
            const leftTarget = visualOrdinalByNodeId.get(leftEdge.edge.to);
            const rightTarget = visualOrdinalByNodeId.get(rightEdge.edge.to);
            if (
              leftSource === undefined ||
              rightSource === undefined ||
              leftTarget === undefined ||
              rightTarget === undefined ||
              leftSource === rightSource ||
              leftTarget === rightTarget
            ) {
              continue;
            }
            if (
              Math.sign(leftSource - rightSource) !==
              Math.sign(leftTarget - rightTarget)
            ) {
              score += 1;
            }
          }
        }
      }
      if (score < bestScore) {
        bestScore = score;
        bestCombination = combination;
      }
    }
    if (!bestCombination) {
      throw new Error(
        `${spec.key}: cannot determine visual node order for band ${band.index}`,
      );
    }
    for (const [index, columnIndex] of band.columnIndexes.entries()) {
      const orderedNodes = bestCombination[index];
      if (!orderedNodes) {
        throw new Error(
          `${spec.key}: missing visual node order for column ${columnIndex}`,
        );
      }
      visualNodesByColumn.set(columnIndex, orderedNodes);
    }
  }
  const sameColumnReferenceEdges = new Set<TDiagramEdge>();
  const sameColumnPathSides = new Map<TDiagramEdge, TSide>();
  for (const item of classifiedEdges) {
    if (item.kind !== 'same-column-rail') {
      continue;
    }
    const nodeIndex = requireNodeIndex(nodeIndexes, item.edge.from, spec.key);
    const band = bands[nodeIndex.bandIndex];
    const orderedNodes = visualNodesByColumn.get(nodeIndex.columnIndex);
    if (!band || !orderedNodes) {
      throw new Error(
        `${spec.key}: missing same-column topology for ${item.edge.from}->${item.edge.to}`,
      );
    }
    const sourceOrdinal = orderedNodes.findIndex(
      (node) => node.id === item.edge.from,
    );
    const targetOrdinal = orderedNodes.findIndex(
      (node) => node.id === item.edge.to,
    );
    const minimumOrdinal = Math.min(sourceOrdinal, targetOrdinal);
    const maximumOrdinal = Math.max(sourceOrdinal, targetOrdinal);
    if (sourceOrdinal < 0 || targetOrdinal < 0) {
      throw new Error(
        `${spec.key}: missing same-column node order for ${item.edge.from}->${item.edge.to}`,
      );
    }
    const columnPosition = band.columnIndexes.indexOf(nodeIndex.columnIndex);
    const candidateSides: TSide[] = [];
    if (columnPosition < band.columnIndexes.length - 1) {
      candidateSides.push('right');
    }
    if (columnPosition > 0) {
      candidateSides.push('left');
    }
    if (candidateSides.length === 0) {
      candidateSides.push('left');
    }
    const hasBoundaryPathInsideSpan = (side: TSide): boolean =>
      classifiedEdges.some((candidate) => {
        if (candidate.kind !== 'forward-lane') {
          return false;
        }
        const from = nodeIndexes.get(candidate.edge.from);
        const to = nodeIndexes.get(candidate.edge.to);
        const nodeIdOnSameBoundary =
          side === 'right' &&
          from?.columnIndex === nodeIndex.columnIndex &&
          to?.columnIndex === nodeIndex.columnIndex + 1
            ? candidate.edge.from
            : side === 'left' &&
                from?.columnIndex === nodeIndex.columnIndex - 1 &&
                to?.columnIndex === nodeIndex.columnIndex
              ? candidate.edge.to
              : undefined;
        if (!nodeIdOnSameBoundary) {
          return false;
        }
        const ordinal = orderedNodes.findIndex(
          (node) => node.id === nodeIdOnSameBoundary,
        );
        return ordinal > minimumOrdinal && ordinal < maximumOrdinal;
      });
    const selectedSide =
      maximumOrdinal - minimumOrdinal <= 1
        ? candidateSides[0]
        : candidateSides.find((side) => !hasBoundaryPathInsideSpan(side));
    if (selectedSide) {
      sameColumnPathSides.set(item.edge, selectedSide);
    } else {
      sameColumnReferenceEdges.add(item.edge);
    }
  }
  const finalClassifiedEdges: TClassifiedEdge[] = classifiedEdges.map((item) =>
    sameColumnReferenceEdges.has(item.edge)
      ? { ...item, kind: 'same-column-reference' }
      : item,
  );
  const referenceEdges = finalClassifiedEdges.filter(
    (item): item is TClassifiedEdge & { kind: TReferenceKind } =>
      item.kind !== 'forward-lane' && item.kind !== 'same-column-rail',
  );
  const codeOrdinals = new Map<string, number>();
  const referenceDescriptors: TReferenceDescriptor[] = referenceEdges.map(
    (item, index) => {
      const ordinal = increment(codeOrdinals, item.kind);
      return {
        index,
        edge: item.edge,
        kind: item.kind,
        code: referenceCode(item.kind, ordinal),
      };
    },
  );
  const referenceControlsByNode = new Map<string, TReferenceControl[]>();
  for (const descriptor of referenceDescriptors) {
    for (const [role, nodeId] of [
      ['source', descriptor.edge.from],
      ['target', descriptor.edge.to],
    ] as const) {
      const controls = referenceControlsByNode.get(nodeId) ?? [];
      controls.push({
        kind: 'reference',
        referenceIndex: descriptor.index,
        role,
        code: descriptor.code,
        width: REFERENCE_CHIP_WIDTH,
        height: REFERENCE_CHIP_HEIGHT,
      });
      referenceControlsByNode.set(nodeId, controls);
    }
  }
  for (const controls of referenceControlsByNode.values()) {
    controls.sort(
      (left, right) =>
        (left.role === right.role ? 0 : left.role === 'source' ? -1 : 1) ||
        left.referenceIndex - right.referenceIndex,
    );
  }
  const referenceEndpointByControl = new Map<
    string,
    TLayoutReference['endpoints'][number]
  >();
  const columns: TDiagramLayout['columns'][number][] = [];
  const nodes: TDiagramLayout['nodes'][number][] = [];

  for (const band of bands) {
    const columnWidth =
      (band.rect.width - COLUMN_GAP * (band.columnIndexes.length - 1)) /
      band.columnIndexes.length;

    for (const [bandColumnIndex, columnIndex] of band.columnIndexes.entries()) {
      const semanticColumn = spec.columns[columnIndex];
      if (!semanticColumn) {
        throw new Error(`${spec.key}: missing column ${columnIndex}`);
      }
      const columnX =
        band.rect.x + bandColumnIndex * (columnWidth + COLUMN_GAP);
      const nodeAreaRect = {
        x: columnX,
        y: band.rect.y + NODE_AREA_TOP,
        width: columnWidth,
        height: band.rect.height - NODE_AREA_TOP - NODE_AREA_BOTTOM,
      };
      const columnTitle = layoutText(
        semanticColumn.title,
        {
          x: columnX,
          y: band.rect.y + COLUMN_TITLE_TOP,
          width: columnWidth,
        },
        TYPOGRAPHY.column,
        COLUMN_TITLE_LINE_HEIGHT,
        'middle',
      );
      if (columnTitle.lines.length > 2) {
        throw new Error(
          `${spec.key}: column ${columnIndex} title exceeds two lines`,
        );
      }

      columns.push({
        index: columnIndex,
        bandIndex: band.index,
        rect: nodeAreaRect,
        title: columnTitle,
      });

      const visualNodes = visualNodesByColumn.get(columnIndex);
      if (!visualNodes) {
        throw new Error(
          `${spec.key}: missing visual nodes for column ${columnIndex}`,
        );
      }
      const pendingNodes = visualNodes.map((semanticNode) => {
        const textWidth = columnWidth - NODE_HORIZONTAL_PADDING * 2;
        const referenceControls =
          referenceControlsByNode.get(semanticNode.id) ?? [];
        const unconstrainedTitleLines = wrapVisibleText(
          semanticNode.label,
          textWidth,
          TYPOGRAPHY.nodeTitle,
        );
        const unconstrainedDetailLines = wrapVisibleText(
          semanticNode.detail,
          textWidth,
          TYPOGRAPHY.nodeDetail,
        );
        if (unconstrainedTitleLines.length > 2) {
          throw new Error(
            `${spec.key}: node ${semanticNode.id} title exceeds two lines`,
          );
        }
        if (unconstrainedDetailLines.length > 4) {
          throw new Error(
            `${spec.key}: node ${semanticNode.id} detail exceeds four lines`,
          );
        }
        const badgeWidth = semanticNode.badge
          ? Math.min(
              textWidth,
              measureVisibleText(semanticNode.badge, TYPOGRAPHY.badge) + 18,
            )
          : 0;
        const badgeControl: TBadgeControl | undefined = semanticNode.badge
          ? {
              kind: 'badge',
              text: semanticNode.badge,
              width: badgeWidth,
              height: 28,
            }
          : undefined;
        const inlineWidth = textWidth - badgeWidth - CONTROL_GAP;
        const placementCandidates = semanticNode.badge
          ? [
              {
                badgePlacement: 'title' as const,
                titleWidth: inlineWidth,
                detailWidth: textWidth,
                controls: referenceControls,
              },
              {
                badgePlacement: 'detail' as const,
                titleWidth: textWidth,
                detailWidth: inlineWidth,
                controls: referenceControls,
              },
              {
                badgePlacement: 'controls' as const,
                titleWidth: textWidth,
                detailWidth: textWidth,
                controls: badgeControl
                  ? [badgeControl, ...referenceControls]
                  : referenceControls,
              },
            ]
          : [
              {
                badgePlacement: 'none' as const,
                titleWidth: textWidth,
                detailWidth: textWidth,
                controls: referenceControls,
              },
            ];
        const candidates = placementCandidates.flatMap((candidate) => {
          if (candidate.titleWidth <= 0 || candidate.detailWidth <= 0) {
            return [];
          }
          const titleLines = wrapVisibleText(
            semanticNode.label,
            candidate.titleWidth,
            TYPOGRAPHY.nodeTitle,
          );
          const detailLines = wrapVisibleText(
            semanticNode.detail,
            candidate.detailWidth,
            TYPOGRAPHY.nodeDetail,
          );
          if (titleLines.length > 2 || detailLines.length > 4) {
            return [];
          }
          const controlRows = packControls(candidate.controls, textWidth);
          const titleBlockHeight = Math.max(
            titleLines.length * NODE_TITLE_LINE_HEIGHT,
            candidate.badgePlacement === 'title' ? 28 : 0,
          );
          const detailBlockHeight = Math.max(
            detailLines.length * NODE_DETAIL_LINE_HEIGHT,
            candidate.badgePlacement === 'detail' ? 28 : 0,
          );
          const controlsHeight = controlRowsHeight(controlRows);
          const contentHeight =
            NODE_VERTICAL_PADDING +
            titleBlockHeight +
            NODE_TEXT_GAP +
            detailBlockHeight +
            (controlRows.length > 0 ? CONTROL_ROW_GAP + controlsHeight : 0) +
            NODE_VERTICAL_PADDING;
          return [
            {
              ...candidate,
              titleLines,
              detailLines,
              titleBlockHeight,
              detailBlockHeight,
              controlRows,
              height: Math.max(NODE_MIN_HEIGHT, contentHeight),
            },
          ];
        });
        const selected = candidates.sort(
          (left, right) => left.height - right.height,
        )[0];
        if (!selected) {
          throw new Error(
            `${spec.key}: node ${semanticNode.id} title/detail cannot fit with its badge`,
          );
        }
        return { semanticNode, badgeWidth, ...selected };
      });
      const totalNodeHeight = pendingNodes.reduce(
        (total, pendingNode) => total + pendingNode.height,
        0,
      );
      const minimumRequiredHeight =
        totalNodeHeight + NODE_GAP * (pendingNodes.length - 1);
      if (minimumRequiredHeight > nodeAreaRect.height) {
        throw new Error(
          `${spec.key}: column ${columnIndex} calculated nodes do not fit band ${band.index} (${minimumRequiredHeight} > ${nodeAreaRect.height}; ${pendingNodes.map((item) => `${item.semanticNode.id}:${item.height}`).join(', ')})`,
        );
      }

      const gap =
        pendingNodes.length === 1
          ? 0
          : (nodeAreaRect.height - totalNodeHeight) / (pendingNodes.length - 1);
      let nodeY =
        pendingNodes.length === 1
          ? nodeAreaRect.y + (nodeAreaRect.height - totalNodeHeight) / 2
          : nodeAreaRect.y;

      for (const pendingNode of pendingNodes) {
        const rect = {
          x: nodeAreaRect.x,
          y: nodeY,
          width: nodeAreaRect.width,
          height: pendingNode.height,
        };
        const titleY = rect.y + NODE_VERTICAL_PADDING;
        const title: TLayoutText = {
          rect: {
            x: rect.x + NODE_HORIZONTAL_PADDING,
            y: titleY,
            width: pendingNode.titleWidth,
            height: pendingNode.titleLines.length * NODE_TITLE_LINE_HEIGHT,
          },
          lines: pendingNode.titleLines,
          fontSize: TYPOGRAPHY.nodeTitle,
          lineHeight: NODE_TITLE_LINE_HEIGHT,
          align: 'start',
        };
        const detailY = titleY + pendingNode.titleBlockHeight + NODE_TEXT_GAP;
        const detail: TLayoutText = {
          rect: {
            x: rect.x + NODE_HORIZONTAL_PADDING,
            y: detailY,
            width: pendingNode.detailWidth,
            height: pendingNode.detailLines.length * NODE_DETAIL_LINE_HEIGHT,
          },
          lines: pendingNode.detailLines,
          fontSize: TYPOGRAPHY.nodeDetail,
          lineHeight: NODE_DETAIL_LINE_HEIGHT,
          align: 'start',
        };
        let badge: { rect: TRect; text: string } | undefined =
          pendingNode.semanticNode.badge &&
          (pendingNode.badgePlacement === 'title' ||
            pendingNode.badgePlacement === 'detail')
            ? {
                rect: {
                  x:
                    rectRight(rect) -
                    NODE_HORIZONTAL_PADDING -
                    pendingNode.badgeWidth,
                  y: pendingNode.badgePlacement === 'title' ? titleY : detailY,
                  width: pendingNode.badgeWidth,
                  height: 28,
                },
                text: pendingNode.semanticNode.badge,
              }
            : undefined;
        let controlY =
          detailY + pendingNode.detailBlockHeight + CONTROL_ROW_GAP;
        for (const controlRow of pendingNode.controlRows) {
          let controlX = rect.x + NODE_HORIZONTAL_PADDING;
          for (const control of controlRow.controls) {
            const controlRect = {
              x: controlX,
              y: controlY,
              width: control.width,
              height: control.height,
            };
            if (control.kind === 'badge') {
              badge = { rect: controlRect, text: control.text };
            } else {
              const label = layoutText(
                control.code,
                {
                  x: controlRect.x + 4,
                  y:
                    controlRect.y +
                    (controlRect.height - CONNECTOR_LINE_HEIGHT) / 2,
                  width: controlRect.width - 8,
                },
                TYPOGRAPHY.connector,
                CONNECTOR_LINE_HEIGHT,
                'middle',
              );
              if (label.lines.length !== 1) {
                throw new Error(
                  `${spec.key}: control code ${control.code} does not fit its chip`,
                );
              }
              referenceEndpointByControl.set(
                `${control.referenceIndex}:${control.role}`,
                {
                  role: control.role,
                  nodeId: pendingNode.semanticNode.id,
                  chipRect: controlRect,
                  label,
                },
              );
            }
            controlX += control.width + CONTROL_GAP;
          }
          controlY += controlRow.height + CONTROL_ROW_GAP;
        }

        nodes.push({
          node: pendingNode.semanticNode,
          bandIndex: band.index,
          columnIndex,
          rect,
          title,
          detail,
          ...(badge ? { badge } : {}),
        });
        nodeY += pendingNode.height + gap;
      }
    }
  }

  const nodeLayouts = new Map(nodes.map((item) => [item.node.id, item]));
  const requireNodeLayout = (
    nodeId: string,
  ): TDiagramLayout['nodes'][number] => {
    const value = nodeLayouts.get(nodeId);
    if (!value) {
      throw new Error(`${spec.key}: missing layout for node ${nodeId}`);
    }
    return value;
  };

  const references: TLayoutReference[] = referenceDescriptors.map(
    (descriptor) => {
      const source = referenceEndpointByControl.get(
        `${descriptor.index}:source`,
      );
      const target = referenceEndpointByControl.get(
        `${descriptor.index}:target`,
      );
      if (!source || !target) {
        throw new Error(
          `${spec.key}: missing paired owner-node controls for ${descriptor.code}`,
        );
      }
      return {
        edge: descriptor.edge,
        kind: descriptor.kind,
        code: descriptor.code,
        endpoints: [source, target],
      };
    },
  );

  const pathEdges = finalClassifiedEdges.filter(
    (item): item is TClassifiedEdge & { kind: TPathKind } =>
      item.kind === 'forward-lane' || item.kind === 'same-column-rail',
  );
  const portTotals = new Map<string, number>();
  const portAssignments = new Map<
    string,
    {
      pathIndex: number;
      role: 'source' | 'target';
      oppositeOrdinal: number;
      oppositeY: number;
    }[]
  >();
  const visualNodeOrdinal = (node: TDiagramLayout['nodes'][number]): number =>
    visualNodesByColumn
      .get(node.columnIndex)
      ?.findIndex((candidate) => candidate.id === node.node.id) ?? -1;
  for (const [pathIndex, item] of pathEdges.entries()) {
    const from = requireNodeLayout(item.edge.from);
    const to = requireNodeLayout(item.edge.to);
    const sameColumnSide = sameColumnPathSides.get(item.edge);
    if (item.kind === 'same-column-rail' && !sameColumnSide) {
      throw new Error(
        `${spec.key}: missing same-column rail side for ${item.edge.from}->${item.edge.to}`,
      );
    }
    const sourceSide = item.kind === 'forward-lane' ? 'right' : sameColumnSide;
    const targetSide = item.kind === 'forward-lane' ? 'left' : sameColumnSide;
    const sourceKey = pointKey(from.node.id, sourceSide);
    const targetKey = pointKey(to.node.id, targetSide);
    const sourceAssignments = portAssignments.get(sourceKey) ?? [];
    sourceAssignments.push({
      pathIndex,
      role: 'source',
      oppositeOrdinal: visualNodeOrdinal(to),
      oppositeY: to.rect.y + to.rect.height / 2,
    });
    portAssignments.set(sourceKey, sourceAssignments);
    const targetAssignments = portAssignments.get(targetKey) ?? [];
    targetAssignments.push({
      pathIndex,
      role: 'target',
      oppositeOrdinal: visualNodeOrdinal(from),
      oppositeY: from.rect.y + from.rect.height / 2,
    });
    portAssignments.set(targetKey, targetAssignments);
  }
  const portOrdinals = new Map<string, number>();
  for (const [portKey, assignments] of portAssignments) {
    assignments.sort(
      (left, right) =>
        (left.role === right.role ? 0 : left.role === 'target' ? -1 : 1) ||
        left.oppositeOrdinal - right.oppositeOrdinal ||
        left.oppositeY - right.oppositeY ||
        left.pathIndex - right.pathIndex,
    );
    portTotals.set(portKey, assignments.length);
    for (const [ordinal, assignment] of assignments.entries()) {
      portOrdinals.set(`${assignment.pathIndex}:${assignment.role}`, ordinal);
    }
  }
  const pathDrafts = pathEdges.map((item, pathIndex) => {
    const from = requireNodeLayout(item.edge.from);
    const to = requireNodeLayout(item.edge.to);
    const sameColumnSide = sameColumnPathSides.get(item.edge);
    if (item.kind === 'same-column-rail' && !sameColumnSide) {
      throw new Error(
        `${spec.key}: missing same-column rail side for ${item.edge.from}->${item.edge.to}`,
      );
    }
    const sourceSide = item.kind === 'forward-lane' ? 'right' : sameColumnSide;
    const targetSide = item.kind === 'forward-lane' ? 'left' : sameColumnSide;
    const sourceKey = pointKey(from.node.id, sourceSide);
    const targetKey = pointKey(to.node.id, targetSide);
    const sourceOrdinal = portOrdinals.get(`${pathIndex}:source`);
    const targetOrdinal = portOrdinals.get(`${pathIndex}:target`);
    if (sourceOrdinal === undefined || targetOrdinal === undefined) {
      throw new Error(`${spec.key}: missing port order for L${pathIndex + 1}`);
    }
    const startAnchor = anchorPoint(
      from.rect,
      sourceSide,
      sourceOrdinal,
      portTotals.get(sourceKey) ?? 1,
    );
    const endAnchor = anchorPoint(
      to.rect,
      targetSide,
      targetOrdinal,
      portTotals.get(targetKey) ?? 1,
    );
    const nudge = (pathIndex + 1) / 100;
    const start = {
      ...startAnchor,
      y: Math.min(rectBottom(from.rect) - 0.5, startAnchor.y + nudge),
    };
    const end = {
      ...endAnchor,
      y: Math.min(rectBottom(to.rect) - 0.5, endAnchor.y + nudge),
    };
    const leftColumnIndex =
      item.kind === 'forward-lane'
        ? from.columnIndex
        : sourceSide === 'right'
          ? from.columnIndex
          : from.columnIndex - 1;
    const gutterLeft =
      item.kind === 'forward-lane'
        ? start.x
        : sourceSide === 'right'
          ? start.x
          : start.x - COLUMN_GAP;
    return {
      pathIndex,
      edge: item.edge,
      code: `L${pathIndex + 1}`,
      kind: item.kind,
      bandIndex: from.bandIndex,
      gutterKey: `b${from.bandIndex}:g:${leftColumnIndex}:${leftColumnIndex + 1}`,
      gutterLeft,
      start,
      end,
    };
  });

  type TPathDraft = (typeof pathDrafts)[number];
  type TPathRoute = Readonly<{
    lane: string;
    segments: TLayoutPath['segments'];
    stripeSide: TSide;
  }>;
  const draftsByGutter = new Map<string, TPathDraft[]>();
  for (const draft of pathDrafts) {
    const group = draftsByGutter.get(draft.gutterKey) ?? [];
    group.push(draft);
    draftsByGutter.set(draft.gutterKey, group);
  }

  const routesByPathIndex = new Map<number, TPathRoute>();
  for (const [gutterKey, group] of draftsByGutter) {
    if (group.length > 5) {
      throw new Error(
        `${spec.key}: ${gutterKey} supports at most five local paths per gutter`,
      );
    }
    const pathIndexes = group.map((draft) => draft.pathIndex);
    let selected:
      | Readonly<{
          routes: ReadonlyMap<number, TPathRoute>;
          stripeSide: TSide;
        }>
      | undefined;

    for (const stripeSide of ['left', 'right'] as const) {
      for (const laneOrder of permutations(pathIndexes)) {
        const rankByPathIndex = new Map(
          laneOrder.map((pathIndex, rank) => [pathIndex, rank]),
        );
        const candidateRoutes = new Map<number, TPathRoute>();
        for (const draft of group) {
          const rank = rankByPathIndex.get(draft.pathIndex);
          if (rank === undefined) {
            throw new Error(`${spec.key}: missing lane rank for ${draft.code}`);
          }
          const stripeX =
            draft.gutterLeft +
            (stripeSide === 'right' ? COLUMN_GAP - PATH_LANE_STRIPE_WIDTH : 0);
          const laneX =
            stripeX +
            ((rank + 1) * PATH_LANE_STRIPE_WIDTH) / (group.length + 1);
          candidateRoutes.set(draft.pathIndex, {
            lane: `${gutterKey}:${rank + 1}`,
            stripeSide,
            segments: [
              {
                from: draft.start,
                to: { x: laneX, y: draft.start.y },
              },
              {
                from: { x: laneX, y: draft.start.y },
                to: { x: laneX, y: draft.end.y },
              },
              {
                from: { x: laneX, y: draft.end.y },
                to: draft.end,
              },
            ],
          });
        }
        const candidateEntries = [...candidateRoutes.entries()];
        const hasIntersection = candidateEntries.some(
          ([leftPathIndex, leftRoute], leftIndex) =>
            candidateEntries
              .slice(leftIndex + 1)
              .some(
                ([rightPathIndex, rightRoute]) =>
                  leftPathIndex !== rightPathIndex &&
                  leftRoute.segments.some((leftSegment) =>
                    rightRoute.segments.some((rightSegment) =>
                      segmentsIntersect(leftSegment, rightSegment),
                    ),
                  ),
              ),
        );
        if (!hasIntersection) {
          selected = { routes: candidateRoutes, stripeSide };
          break;
        }
      }
      if (selected) {
        break;
      }
    }

    if (!selected) {
      throw new Error(
        `${spec.key}: no intersection-free lane order for ${gutterKey} (${group
          .map(
            (draft) =>
              `${draft.code}:${draft.edge.from}->${draft.edge.to}@${draft.start.y.toFixed(2)}:${draft.end.y.toFixed(2)}`,
          )
          .join(', ')})`,
      );
    }
    for (const [pathIndex, route] of selected.routes) {
      routesByPathIndex.set(pathIndex, route);
    }
  }

  const occupiedPathLabelRects: TRect[] = [];
  const paths: TLayoutPath[] = pathDrafts.map((draft) => {
    const route = routesByPathIndex.get(draft.pathIndex);
    if (!route) {
      throw new Error(`${spec.key}: missing route for ${draft.code}`);
    }
    const band = bands[draft.bandIndex];
    const group = draftsByGutter.get(draft.gutterKey);
    if (!band || !group) {
      throw new Error(
        `${spec.key}: missing path-label gutter ${draft.gutterKey}`,
      );
    }
    const groupSegments = group.flatMap((item) => {
      const itemRoute = routesByPathIndex.get(item.pathIndex);
      return itemRoute ? [...itemRoute.segments] : [];
    });
    const labelX =
      draft.gutterLeft +
      (route.stripeSide === 'left' ? PATH_LANE_STRIPE_WIDTH : 0);
    const firstSlotY = band.rect.y + NODE_AREA_TOP;
    const slotStep = PATH_LABEL_HEIGHT + CONTROL_ROW_GAP;
    const slotCount =
      Math.floor(
        (rectBottom(band.rect) - firstSlotY - PATH_LABEL_HEIGHT) / slotStep,
      ) + 1;
    const preferredY = (draft.start.y + draft.end.y) / 2;
    const slotYs = Array.from(
      { length: slotCount },
      (_, index) => firstSlotY + index * slotStep,
    ).sort(
      (left, right) =>
        Math.abs(left + PATH_LABEL_HEIGHT / 2 - preferredY) -
          Math.abs(right + PATH_LABEL_HEIGHT / 2 - preferredY) || left - right,
    );
    const labelRect = slotYs
      .map((y) => ({
        x: labelX,
        y,
        width: PATH_LABEL_WIDTH,
        height: PATH_LABEL_HEIGHT,
      }))
      .find(
        (candidate) =>
          occupiedPathLabelRects.every(
            (occupied) => !rectanglesIntersect(candidate, occupied),
          ) &&
          groupSegments.every(
            (segment) => !segmentIntersectsRectangle(segment, candidate),
          ),
      );
    if (!labelRect) {
      throw new Error(
        `${spec.key}: no collision-free path-label slot for ${draft.code}`,
      );
    }
    occupiedPathLabelRects.push(labelRect);
    const label = layoutText(
      draft.code,
      { x: labelRect.x, y: labelRect.y, width: labelRect.width },
      TYPOGRAPHY.connector,
      PATH_LABEL_HEIGHT,
      'middle',
    );
    if (label.lines.length !== 1) {
      throw new Error(`${spec.key}: path code ${draft.code} exceeds one line`);
    }
    return {
      edge: draft.edge,
      code: draft.code,
      kind: draft.kind,
      lane: route.lane,
      segments: route.segments,
      label,
    };
  });

  const headerTitle = layoutText(
    spec.title,
    { x: 48, y: 10, width: 1304 },
    TYPOGRAPHY.title,
    50,
  );
  const headerSubtitle = layoutText(
    spec.subtitle,
    { x: 48, y: 64, width: 1304 },
    TYPOGRAPHY.subtitle,
    34,
  );
  const headerScope = layoutText(
    spec.scope,
    { x: 48, y: 104, width: 1304 },
    TYPOGRAPHY.scope,
    30,
  );
  const legendValues = [
    'Luồng chính / điều hướng',
    'Bất đồng bộ / webhook',
    'Audit / bằng chứng',
  ];
  const footerColumnGap = 16;
  const footerColumnWidth = (1304 - footerColumnGap * 3) / 4;
  const footerColumnX = (index: number): number =>
    48 + index * (footerColumnWidth + footerColumnGap);
  const legendItems = legendValues.map((value, index) =>
    layoutText(
      value,
      { x: footerColumnX(index), y: 1610, width: footerColumnWidth },
      TYPOGRAPHY.footer,
      22,
    ),
  );
  if (spec.edges.length > 24) {
    throw new Error(
      `${spec.key}: footer edge directory supports at most twenty-four entries`,
    );
  }
  const edgeCodes = new Map<TDiagramEdge, string>([
    ...paths.map((path) => [path.edge, path.code] as const),
    ...references.map((reference) => [reference.edge, reference.code] as const),
  ]);
  const edgeItems = spec.edges.map((edge, index) => {
    const code = edgeCodes.get(edge);
    if (!code) {
      throw new Error(`${spec.key}: missing footer code for edge ${index + 1}`);
    }
    const text = layoutText(
      `${code} — ${edge.label}`,
      {
        x: footerColumnX(index % 4),
        y: 1632 + Math.floor(index / 4) * 22,
        width: footerColumnWidth,
      },
      TYPOGRAPHY.footer,
      22,
    );
    return { code, edge, text };
  });
  const overflowingEdgeItems = edgeItems.filter(
    (item) => item.text.lines.length !== 1,
  );
  if (overflowingEdgeItems.length > 0) {
    throw new Error(
      `${spec.key}: footer edges exceed one line: ${overflowingEdgeItems
        .map(
          (item) =>
            `${item.code}="${item.edge.label}" (${measureVisibleText(`${item.code} — ${item.edge.label}`, TYPOGRAPHY.footer)})`,
        )
        .join(', ')} > ${footerColumnWidth}`,
    );
  }
  const warning = layoutText(
    'Hình minh họa; nội dung SRS chuẩn tắc vẫn là nguồn quyết định.',
    { x: 48, y: 1770, width: 1304 },
    TYPOGRAPHY.footer,
    22,
  );

  return {
    key: spec.key,
    viewBox: VIEWBOX,
    typography: TYPOGRAPHY,
    header: {
      title: headerTitle,
      subtitle: headerSubtitle,
      scope: headerScope,
    },
    bands,
    columns,
    nodes,
    paths,
    references,
    footer: { legendItems, edgeItems, warning },
  };
};
