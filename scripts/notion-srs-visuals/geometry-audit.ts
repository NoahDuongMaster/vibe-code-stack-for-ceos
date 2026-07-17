import { measureVisibleText } from './diagram-layout.ts';

import type {
  TDiagramLayout,
  TLayoutPath,
  TPoint,
  TRect,
  TSegment,
} from './types.ts';

const FOOTER_BOUND = 1610;
const EPSILON = 0.000_001;

type TVisualKind = 'label' | 'badge' | 'reference';

type TVisualRect = Readonly<{
  id: string;
  kind: TVisualKind;
  rect: TRect;
  ownerNodeId?: string;
}>;

type TTrackedRect = Readonly<{
  id: string;
  rect: TRect;
  footer: boolean;
}>;

type TTrackedSegment = Readonly<{
  id: string;
  pathIndex: number;
  segmentIndex: number;
  path: TLayoutPath;
  segment: TSegment;
}>;

const rectRight = (rect: TRect): number => rect.x + rect.width;
const rectBottom = (rect: TRect): number => rect.y + rect.height;

const rectanglesIntersect = (left: TRect, right: TRect): boolean =>
  left.x < rectRight(right) - EPSILON &&
  rectRight(left) > right.x + EPSILON &&
  left.y < rectBottom(right) - EPSILON &&
  rectBottom(left) > right.y + EPSILON;

const containsRect = (outer: TRect, inner: TRect): boolean =>
  inner.x >= outer.x - EPSILON &&
  inner.y >= outer.y - EPSILON &&
  rectRight(inner) <= rectRight(outer) + EPSILON &&
  rectBottom(inner) <= rectBottom(outer) + EPSILON;

const pointOnRectBoundary = (point: TPoint, rect: TRect): boolean => {
  const onHorizontal =
    point.x >= rect.x - EPSILON &&
    point.x <= rectRight(rect) + EPSILON &&
    (Math.abs(point.y - rect.y) <= EPSILON ||
      Math.abs(point.y - rectBottom(rect)) <= EPSILON);
  const onVertical =
    point.y >= rect.y - EPSILON &&
    point.y <= rectBottom(rect) + EPSILON &&
    (Math.abs(point.x - rect.x) <= EPSILON ||
      Math.abs(point.x - rectRight(rect)) <= EPSILON);
  return onHorizontal || onVertical;
};

const isAxisAligned = (segment: TSegment): boolean =>
  Math.abs(segment.from.x - segment.to.x) <= EPSILON ||
  Math.abs(segment.from.y - segment.to.y) <= EPSILON;

const segmentIntersectsRect = (segment: TSegment, rect: TRect): boolean => {
  if (!isAxisAligned(segment)) {
    return false;
  }

  if (Math.abs(segment.from.y - segment.to.y) <= EPSILON) {
    const minimumX = Math.min(segment.from.x, segment.to.x);
    const maximumX = Math.max(segment.from.x, segment.to.x);
    return (
      segment.from.y >= rect.y - EPSILON &&
      segment.from.y <= rectBottom(rect) + EPSILON &&
      maximumX >= rect.x - EPSILON &&
      minimumX <= rectRight(rect) + EPSILON
    );
  }

  const minimumY = Math.min(segment.from.y, segment.to.y);
  const maximumY = Math.max(segment.from.y, segment.to.y);
  return (
    segment.from.x >= rect.x - EPSILON &&
    segment.from.x <= rectRight(rect) + EPSILON &&
    maximumY >= rect.y - EPSILON &&
    minimumY <= rectBottom(rect) + EPSILON
  );
};

const moveToward = (from: TPoint, to: TPoint): TPoint => {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.abs(deltaX) + Math.abs(deltaY);
  if (length <= EPSILON) {
    return to;
  }
  return {
    x: from.x + (deltaX / length) * EPSILON * 10,
    y: from.y + (deltaY / length) * EPSILON * 10,
  };
};

const onlyAllowedEndpointContact = (
  tracked: TTrackedSegment,
  nodeId: string,
  nodeRect: TRect,
): boolean => {
  const isFirst = tracked.segmentIndex === 0;
  const isLast = tracked.segmentIndex === tracked.path.segments.length - 1;

  if (
    isFirst &&
    tracked.path.edge.from === nodeId &&
    pointOnRectBoundary(tracked.segment.from, nodeRect)
  ) {
    return !segmentIntersectsRect(
      {
        from: moveToward(tracked.segment.from, tracked.segment.to),
        to: tracked.segment.to,
      },
      nodeRect,
    );
  }

  if (
    isLast &&
    tracked.path.edge.to === nodeId &&
    pointOnRectBoundary(tracked.segment.to, nodeRect)
  ) {
    return !segmentIntersectsRect(
      {
        from: tracked.segment.from,
        to: moveToward(tracked.segment.to, tracked.segment.from),
      },
      nodeRect,
    );
  }

  return false;
};

const collinearOverlapLength = (left: TSegment, right: TSegment): number => {
  if (!isAxisAligned(left) || !isAxisAligned(right)) {
    return 0;
  }

  const leftHorizontal = Math.abs(left.from.y - left.to.y) <= EPSILON;
  const rightHorizontal = Math.abs(right.from.y - right.to.y) <= EPSILON;
  if (leftHorizontal !== rightHorizontal) {
    return 0;
  }

  if (leftHorizontal) {
    if (Math.abs(left.from.y - right.from.y) > EPSILON) {
      return 0;
    }
    return (
      Math.min(
        Math.max(left.from.x, left.to.x),
        Math.max(right.from.x, right.to.x),
      ) -
      Math.max(
        Math.min(left.from.x, left.to.x),
        Math.min(right.from.x, right.to.x),
      )
    );
  }

  if (Math.abs(left.from.x - right.from.x) > EPSILON) {
    return 0;
  }
  return (
    Math.min(
      Math.max(left.from.y, left.to.y),
      Math.max(right.from.y, right.to.y),
    ) -
    Math.max(
      Math.min(left.from.y, left.to.y),
      Math.min(right.from.y, right.to.y),
    )
  );
};

const segmentsIntersect = (left: TSegment, right: TSegment): boolean => {
  if (!isAxisAligned(left) || !isAxisAligned(right)) {
    return false;
  }
  const leftHorizontal = Math.abs(left.from.y - left.to.y) <= EPSILON;
  const rightHorizontal = Math.abs(right.from.y - right.to.y) <= EPSILON;
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
      Math.abs(left.from.y - right.from.y) <= EPSILON &&
      leftMaximumX >= rightMinimumX - EPSILON &&
      rightMaximumX >= leftMinimumX - EPSILON
    );
  }
  if (!leftHorizontal && !rightHorizontal) {
    return (
      Math.abs(left.from.x - right.from.x) <= EPSILON &&
      leftMaximumY >= rightMinimumY - EPSILON &&
      rightMaximumY >= leftMinimumY - EPSILON
    );
  }

  const horizontal = leftHorizontal ? left : right;
  const vertical = leftHorizontal ? right : left;
  const horizontalMinimumX = Math.min(horizontal.from.x, horizontal.to.x);
  const horizontalMaximumX = Math.max(horizontal.from.x, horizontal.to.x);
  const verticalMinimumY = Math.min(vertical.from.y, vertical.to.y);
  const verticalMaximumY = Math.max(vertical.from.y, vertical.to.y);
  return (
    vertical.from.x >= horizontalMinimumX - EPSILON &&
    vertical.from.x <= horizontalMaximumX + EPSILON &&
    horizontal.from.y >= verticalMinimumY - EPSILON &&
    horizontal.from.y <= verticalMaximumY + EPSILON
  );
};

const appendRectBoundsErrors = (
  errors: string[],
  key: string,
  tracked: TTrackedRect,
  viewBox: TDiagramLayout['viewBox'],
): void => {
  if (
    tracked.rect.x < -EPSILON ||
    tracked.rect.y < -EPSILON ||
    rectRight(tracked.rect) > viewBox.width + EPSILON ||
    rectBottom(tracked.rect) > viewBox.height + EPSILON
  ) {
    errors.push(`${key}: ${tracked.id} outside canvas`);
  }
  if (!tracked.footer && rectBottom(tracked.rect) >= FOOTER_BOUND - EPSILON) {
    errors.push(`${key}: ${tracked.id} crosses footer bound`);
  }
  if (tracked.footer && tracked.rect.y < FOOTER_BOUND - EPSILON) {
    errors.push(`${key}: ${tracked.id} outside footer region`);
  }
};

export const auditDiagramGeometry = (layout: TDiagramLayout): string[] => {
  const errors: string[] = [];
  const nodeById = new Map(layout.nodes.map((node) => [node.node.id, node]));

  for (let leftIndex = 0; leftIndex < layout.nodes.length; leftIndex += 1) {
    const left = layout.nodes[leftIndex];
    if (!left) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < layout.nodes.length;
      rightIndex += 1
    ) {
      const right = layout.nodes[rightIndex];
      if (right && rectanglesIntersect(left.rect, right.rect)) {
        errors.push(
          `${layout.key}: node overlap ${left.node.id} ↔ ${right.node.id}`,
        );
      }
    }
  }

  const visuals: TVisualRect[] = [
    { id: 'header:title', kind: 'label', rect: layout.header.title.rect },
    {
      id: 'header:subtitle',
      kind: 'label',
      rect: layout.header.subtitle.rect,
    },
    { id: 'header:scope', kind: 'label', rect: layout.header.scope.rect },
    ...layout.columns.map((column) => ({
      id: `column:${column.index}:title`,
      kind: 'label' as const,
      rect: column.title.rect,
    })),
    ...layout.nodes.flatMap((node) => [
      {
        id: `node:${node.node.id}:title`,
        kind: 'label' as const,
        rect: node.title.rect,
        ownerNodeId: node.node.id,
      },
      {
        id: `node:${node.node.id}:detail`,
        kind: 'label' as const,
        rect: node.detail.rect,
        ownerNodeId: node.node.id,
      },
      ...(node.badge
        ? [
            {
              id: `node:${node.node.id}:badge`,
              kind: 'badge' as const,
              rect: node.badge.rect,
              ownerNodeId: node.node.id,
            },
          ]
        : []),
    ]),
    ...layout.paths.map((path, index) => ({
      id: `path:${index}:${path.edge.from}->${path.edge.to}:label`,
      kind: 'label' as const,
      rect: path.label.rect,
    })),
    ...layout.footer.legendItems.map((item, index) => ({
      id: `footer:legend:${index}`,
      kind: 'label' as const,
      rect: item.rect,
    })),
    ...layout.footer.edgeItems.map((item, index) => ({
      id: `footer:edge:${index}`,
      kind: 'label' as const,
      rect: item.text.rect,
    })),
    {
      id: 'footer:warning',
      kind: 'label',
      rect: layout.footer.warning.rect,
    },
  ];

  const referenceVisuals: TVisualRect[] = [];
  const referenceCodes = new Map<string, number>();
  for (const [referenceIndex, reference] of layout.references.entries()) {
    const previousCodeIndex = referenceCodes.get(reference.code);
    if (previousCodeIndex !== undefined) {
      errors.push(
        `${layout.key}: duplicate reference code ${reference.code} at ${previousCodeIndex}/${referenceIndex}`,
      );
    } else {
      referenceCodes.set(reference.code, referenceIndex);
    }

    const endpoints =
      reference.endpoints as readonly TLayoutReferenceEndpoint[];
    if (endpoints.length !== 2) {
      errors.push(
        `${layout.key}: ${reference.code} paired reference requires exactly two endpoints`,
      );
    }

    for (const [endpointIndex, endpoint] of endpoints.entries()) {
      const endpointId = `reference:${reference.code}:${endpointIndex}:${endpoint.role}`;
      const expectedRole = endpointIndex === 0 ? 'source' : 'target';
      const expectedNodeId =
        expectedRole === 'source' ? reference.edge.from : reference.edge.to;
      if (
        endpoint.role !== expectedRole ||
        endpoint.nodeId !== expectedNodeId
      ) {
        errors.push(
          `${layout.key}: ${endpointId} does not match paired reference edge`,
        );
      }
      const owner = nodeById.get(endpoint.nodeId);
      if (!owner) {
        errors.push(`${layout.key}: ${endpointId} references unknown node`);
      } else if (!containsRect(owner.rect, endpoint.chipRect)) {
        errors.push(
          `${layout.key}: ${endpointId} reference chip outside owner node ${endpoint.nodeId}`,
        );
      }
      if (!containsRect(endpoint.chipRect, endpoint.label.rect)) {
        errors.push(
          `${layout.key}: ${endpointId} reference label outside chip`,
        );
      }
      const labelValue = endpoint.label.lines.join('');
      if (labelValue !== reference.code) {
        errors.push(
          `${layout.key}: ${endpointId} does not expose its reference code`,
        );
      }

      referenceVisuals.push({
        id: endpointId,
        kind: 'reference',
        rect: endpoint.chipRect,
        ownerNodeId: endpoint.nodeId,
      });
    }
  }

  const laidOutEdges = [
    ...layout.paths.map((path, index) => ({
      id: `path:${index}`,
      edge: path.edge,
      code: path.code,
    })),
    ...layout.references.map((reference, index) => ({
      id: `reference:${index}`,
      edge: reference.edge,
      code: reference.code,
    })),
  ];
  const edgeCodes = new Map<TDiagramLayout['paths'][number]['edge'], string>();
  const codeOwners = new Map<string, string>();
  for (const laidOutEdge of laidOutEdges) {
    const existingEdgeCode = edgeCodes.get(laidOutEdge.edge);
    if (existingEdgeCode !== undefined) {
      errors.push(
        `${layout.key}: edge rendered more than once ${laidOutEdge.edge.from}->${laidOutEdge.edge.to}`,
      );
    } else {
      edgeCodes.set(laidOutEdge.edge, laidOutEdge.code);
    }
    const existingCodeOwner = codeOwners.get(laidOutEdge.code);
    if (existingCodeOwner !== undefined) {
      errors.push(
        `${layout.key}: duplicate edge code ${laidOutEdge.code} at ${existingCodeOwner}/${laidOutEdge.id}`,
      );
    } else {
      codeOwners.set(laidOutEdge.code, laidOutEdge.id);
    }
  }

  if (layout.footer.edgeItems.length !== laidOutEdges.length) {
    errors.push(
      `${layout.key}: footer edge count ${layout.footer.edgeItems.length} does not match ${laidOutEdges.length}`,
    );
  }
  const footerEdges = new Map<
    TDiagramLayout['paths'][number]['edge'],
    number
  >();
  for (const [index, item] of layout.footer.edgeItems.entries()) {
    const expectedCode = edgeCodes.get(item.edge);
    if (expectedCode === undefined) {
      errors.push(`${layout.key}: footer unknown edge at ${index}`);
    } else if (item.code !== expectedCode) {
      errors.push(
        `${layout.key}: footer code mismatch at ${index}: ${item.code} != ${expectedCode}`,
      );
    }
    const expectedText = `${item.code} — ${item.edge.label}`;
    const visibleText = item.text.lines.join('');
    if (visibleText !== expectedText) {
      errors.push(`${layout.key}: footer text mismatch at ${index}`);
    }
    if (item.text.lines.length !== 1) {
      errors.push(`${layout.key}: footer text exceeds one line at ${index}`);
    }
    if (
      measureVisibleText(visibleText, item.text.fontSize) >
      item.text.rect.width + EPSILON
    ) {
      errors.push(
        `${layout.key}: footer edge text exceeds cell width at ${index}`,
      );
    }
    if (visibleText.includes('…')) {
      errors.push(`${layout.key}: footer ellipsis at ${index}`);
    }
    const footerCount = (footerEdges.get(item.edge) ?? 0) + 1;
    footerEdges.set(item.edge, footerCount);
    if (footerCount > 1) {
      errors.push(
        `${layout.key}: footer duplicate edge ${item.edge.from}->${item.edge.to}`,
      );
    }
  }
  for (const laidOutEdge of laidOutEdges) {
    if (!footerEdges.has(laidOutEdge.edge)) {
      errors.push(
        `${layout.key}: footer missing edge ${laidOutEdge.edge.from}->${laidOutEdge.edge.to}`,
      );
    }
  }
  if (
    new Set(layout.footer.edgeItems.map((item) => item.text.rect.x)).size > 4
  ) {
    errors.push(`${layout.key}: footer exceeds four columns`);
  }
  if (
    new Set(layout.footer.edgeItems.map((item) => item.text.rect.y)).size > 6
  ) {
    errors.push(`${layout.key}: footer exceeds six rows`);
  }

  for (const visual of visuals) {
    for (const node of layout.nodes) {
      if (
        visual.ownerNodeId !== node.node.id &&
        rectanglesIntersect(visual.rect, node.rect)
      ) {
        errors.push(
          `${layout.key}: label overlaps node ${visual.id} ↔ ${node.node.id}`,
        );
      }
    }
  }

  for (const reference of referenceVisuals) {
    for (const node of layout.nodes) {
      if (
        reference.ownerNodeId !== node.node.id &&
        rectanglesIntersect(reference.rect, node.rect)
      ) {
        errors.push(
          `${layout.key}: reference overlaps node ${reference.id} ↔ ${node.node.id}`,
        );
      }
    }
    for (const content of visuals) {
      if (rectanglesIntersect(reference.rect, content.rect)) {
        errors.push(
          `${layout.key}: reference overlaps content ${reference.id} ↔ ${content.id}`,
        );
      }
    }
  }

  for (let leftIndex = 0; leftIndex < referenceVisuals.length; leftIndex += 1) {
    const left = referenceVisuals[leftIndex];
    if (!left) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < referenceVisuals.length;
      rightIndex += 1
    ) {
      const right = referenceVisuals[rightIndex];
      if (right && rectanglesIntersect(left.rect, right.rect)) {
        errors.push(
          `${layout.key}: reference overlap ${left.id} ↔ ${right.id}`,
        );
      }
    }
  }

  for (const node of layout.nodes) {
    if (node.badge && rectanglesIntersect(node.badge.rect, node.title.rect)) {
      errors.push(`${layout.key}: badge overlaps title ${node.node.id}`);
    }
  }

  for (let leftIndex = 0; leftIndex < visuals.length; leftIndex += 1) {
    const left = visuals[leftIndex];
    if (!left) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < visuals.length;
      rightIndex += 1
    ) {
      const right = visuals[rightIndex];
      if (right && rectanglesIntersect(left.rect, right.rect)) {
        errors.push(`${layout.key}: label overlap ${left.id} ↔ ${right.id}`);
      }
    }
  }

  for (const [pathIndex, path] of layout.paths.entries()) {
    if (path.label.lines.length !== 1) {
      errors.push(
        `${layout.key}: path marker exceeds one line ${pathIndex}:${path.edge.from}->${path.edge.to}`,
      );
    }
    if (path.label.lines.join('') !== path.code) {
      errors.push(
        `${layout.key}: path marker mismatch ${pathIndex}:${path.edge.from}->${path.edge.to}`,
      );
    }
  }

  const trackedSegments: TTrackedSegment[] = layout.paths.flatMap(
    (path, pathIndex) =>
      path.segments.map((segment, segmentIndex) => ({
        id: `path:${pathIndex}:${path.edge.from}->${path.edge.to}:segment:${segmentIndex}`,
        pathIndex,
        segmentIndex,
        path,
        segment,
      })),
  );

  for (const tracked of trackedSegments) {
    if (!isAxisAligned(tracked.segment)) {
      errors.push(`${layout.key}: ${tracked.id} is not axis aligned`);
      continue;
    }
    for (const node of layout.nodes) {
      if (
        segmentIntersectsRect(tracked.segment, node.rect) &&
        !onlyAllowedEndpointContact(tracked, node.node.id, node.rect)
      ) {
        errors.push(
          `${layout.key}: path crosses node ${tracked.id} ↔ ${node.node.id}`,
        );
      }
    }
    const blockingVisuals = [
      ...layout.paths.map((path, index) => ({
        id: `path:${index}:${path.edge.from}->${path.edge.to}:label`,
        rect: path.label.rect,
      })),
      ...referenceVisuals.map((visual) => ({
        id: visual.id,
        rect: visual.rect,
      })),
    ];
    for (const visual of blockingVisuals) {
      if (segmentIntersectsRect(tracked.segment, visual.rect)) {
        errors.push(
          `${layout.key}: path crosses visual ${tracked.id} ↔ ${visual.id}`,
        );
      }
    }
  }

  for (let leftIndex = 0; leftIndex < trackedSegments.length; leftIndex += 1) {
    const left = trackedSegments[leftIndex];
    if (!left) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < trackedSegments.length;
      rightIndex += 1
    ) {
      const right = trackedSegments[rightIndex];
      if (right && left.pathIndex !== right.pathIndex) {
        if (collinearOverlapLength(left.segment, right.segment) > EPSILON) {
          errors.push(`${layout.key}: shared segment ${left.id} ↔ ${right.id}`);
        } else if (segmentsIntersect(left.segment, right.segment)) {
          errors.push(
            `${layout.key}: path intersection ${left.id} ↔ ${right.id}`,
          );
        }
      }
    }
  }

  const trackedRects: TTrackedRect[] = [
    ...layout.bands.map((band) => ({
      id: `band:${band.index}`,
      rect: band.rect,
      footer: false,
    })),
    ...layout.columns.map((column) => ({
      id: `column:${column.index}`,
      rect: column.rect,
      footer: false,
    })),
    ...layout.nodes.map((node) => ({
      id: `node:${node.node.id}`,
      rect: node.rect,
      footer: false,
    })),
    ...visuals.map((visual) => ({
      id: visual.id,
      rect: visual.rect,
      footer: visual.id.startsWith('footer:'),
    })),
    ...referenceVisuals.map((visual) => ({
      id: visual.id,
      rect: visual.rect,
      footer: false,
    })),
  ];
  for (const tracked of trackedRects) {
    appendRectBoundsErrors(errors, layout.key, tracked, layout.viewBox);
  }

  for (const tracked of trackedSegments) {
    for (const [pointRole, point] of [
      ['from', tracked.segment.from],
      ['to', tracked.segment.to],
    ] as const) {
      if (
        point.x < -EPSILON ||
        point.y < -EPSILON ||
        point.x > layout.viewBox.width + EPSILON ||
        point.y > layout.viewBox.height + EPSILON
      ) {
        errors.push(`${layout.key}: ${tracked.id}:${pointRole} outside canvas`);
      }
      if (point.y >= FOOTER_BOUND - EPSILON) {
        errors.push(
          `${layout.key}: ${tracked.id}:${pointRole} crosses footer bound`,
        );
      }
    }
  }

  return errors;
};

type TLayoutReferenceEndpoint =
  TDiagramLayout['references'][number]['endpoints'][number];
