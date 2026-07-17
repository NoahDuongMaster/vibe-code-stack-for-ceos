import assert from 'node:assert/strict';
import test from 'node:test';

import { BACKEND_SPECS } from './backend-specs.ts';
import { layoutDiagram } from './diagram-layout.ts';
import { auditDiagramGeometry } from './geometry-audit.ts';
import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import type {
  TDiagramLayout,
  TDiagramSpec,
  TLayoutReference,
} from './types.ts';
import { UI_SPECS } from './ui-specs.ts';

const AUDIT_SPEC: TDiagramSpec = {
  key: 'invalid-geometry-fixture',
  title: 'Sơ đồ kiểm thử hình học',
  subtitle: 'CN-001–CN-004',
  scope: 'Fixture chủ ý tạo mọi nhóm lỗi hình học cần được báo cáo.',
  columns: [
    {
      title: 'Nguồn',
      nodes: [
        {
          id: 'source',
          label: 'Nút nguồn',
          detail: 'Phát lệnh và tham chiếu.',
          tone: 'creator',
          badge: 'Mới',
        },
      ],
    },
    {
      title: 'Đích',
      nodes: [
        {
          id: 'target',
          label: 'Nút đích',
          detail: 'Nhận kết quả chuẩn tắc.',
          tone: 'system',
          badge: 'Mở rộng',
        },
      ],
    },
    {
      title: 'Nguồn sau',
      nodes: [
        {
          id: 'later-source',
          label: 'Nguồn tầng sau',
          detail: 'Phát lệnh tại tầng sau.',
          tone: 'seller',
          badge: 'Mới',
        },
      ],
    },
    {
      title: 'Đích sau',
      nodes: [
        {
          id: 'later-target',
          label: 'Đích tầng sau',
          detail: 'Nhận lệnh tại tầng sau.',
          tone: 'ops',
          badge: 'Mở rộng',
        },
      ],
    },
  ],
  edges: [
    {
      from: 'source',
      to: 'target',
      label: 'đi tiếp tại tầng đầu',
      style: 'solid',
    },
    {
      from: 'later-source',
      to: 'later-target',
      label: 'đi tiếp tại tầng sau',
      style: 'solid',
    },
    {
      from: 'source',
      to: 'target',
      label: 'bằng chứng nguồn',
      style: 'dotted',
    },
    {
      from: 'later-source',
      to: 'later-target',
      label: 'bằng chứng tầng sau',
      style: 'dotted',
    },
  ],
};

const invalidLayout = (): TDiagramLayout => {
  const base = layoutDiagram(AUDIT_SPEC);
  const [source, target, laterSource] = base.nodes;
  const [firstPath, secondPath] = base.paths;
  const [firstReference, secondReference] = base.references;
  const targetBand = base.bands[target.bandIndex];
  assert.ok(source && target && laterSource);
  assert.ok(firstPath && secondPath);
  assert.ok(firstReference && secondReference);
  assert.ok(targetBand);

  const sharedCrossingSegment = {
    from: {
      x: laterSource.rect.x - 12,
      y: laterSource.rect.y + laterSource.rect.height / 2,
    },
    to: {
      x: laterSource.rect.x + laterSource.rect.width + 12,
      y: laterSource.rect.y + laterSource.rect.height / 2,
    },
  };
  const collidingReference: TLayoutReference = {
    ...firstReference,
    endpoints: [
      {
        ...firstReference.endpoints[0],
        chipRect: source.title.rect,
        label: {
          ...firstReference.endpoints[0].label,
          rect: source.title.rect,
        },
      },
      {
        ...firstReference.endpoints[1],
        chipRect: {
          x: targetBand.rect.x - 24,
          y: target.rect.y,
          width: 48,
          height: 30,
        },
        label: {
          ...firstReference.endpoints[1].label,
          rect: {
            x: targetBand.rect.x - 20,
            y: target.rect.y + 1,
            width: 40,
            height: 28,
          },
        },
      },
    ],
  };
  const duplicateAndUnpairedReference = {
    ...secondReference,
    code: collidingReference.code,
    endpoints: [
      {
        ...secondReference.endpoints[0],
        nodeId: source.node.id,
        chipRect: source.title.rect,
        label: {
          ...secondReference.endpoints[0].label,
          rect: source.title.rect,
        },
      },
    ],
  } as unknown as TLayoutReference;

  return {
    ...base,
    header: {
      ...base.header,
      title: { ...base.header.title, rect: source.rect },
      subtitle: { ...base.header.subtitle, rect: source.rect },
      scope: {
        ...base.header.scope,
        rect: { x: -12, y: 1595, width: 200, height: 40 },
      },
    },
    nodes: base.nodes.map((node) => {
      if (node.node.id === target.node.id) {
        return {
          ...node,
          rect: source.rect,
          title: { ...node.title, rect: source.title.rect },
        };
      }
      if (node.node.id === source.node.id && node.badge) {
        return {
          ...node,
          badge: { ...node.badge, rect: source.title.rect },
        };
      }
      return node;
    }),
    paths: [
      {
        ...firstPath,
        segments: [sharedCrossingSegment],
        label: {
          ...firstPath.label,
          rect: laterSource.rect,
          lines: ['một', 'hai', 'ba', 'bốn', 'năm'],
        },
      },
      {
        ...secondPath,
        segments: [sharedCrossingSegment],
        label: { ...secondPath.label, rect: laterSource.rect },
      },
    ],
    references: [collidingReference, duplicateAndUnpairedReference],
  };
};

const ALL_SPECS = [
  ...OVERVIEW_AND_TEST_SPECS,
  ...BACKEND_SPECS,
  ...UI_SPECS,
] as const satisfies readonly TDiagramSpec[];

test('should report every collision, overflow and paired-reference violation', () => {
  const errors = auditDiagramGeometry(invalidLayout());

  for (const category of [
    'node overlap',
    'label overlaps node',
    'label overlap',
    'badge overlaps title',
    'reference overlaps content',
    'reference overlap',
    'reference chip outside owner node',
    'path marker exceeds one line',
    'path crosses node',
    'shared segment',
    'outside canvas',
    'crosses footer bound',
    'duplicate reference code',
    'paired reference requires exactly two endpoints',
  ]) {
    assert.ok(
      errors.some((error) => error.includes(category)),
      `missing ${category}:\n${errors.join('\n')}`,
    );
  }
});

test('should audit footer directory labels as first-class visuals', () => {
  const base = layoutDiagram(AUDIT_SPEC);
  const firstEdgeItem = base.footer.edgeItems[0];
  assert.ok(firstEdgeItem);
  const layout: TDiagramLayout = {
    ...base,
    footer: {
      ...base.footer,
      edgeItems: [
        {
          ...firstEdgeItem,
          text: {
            ...firstEdgeItem.text,
            rect: { x: -8, y: 1788, width: 320, height: 22 },
          },
        },
        ...base.footer.edgeItems.slice(1),
      ],
    },
  };

  const errors = auditDiagramGeometry(layout);
  assert.ok(
    errors.some(
      (error) =>
        error.includes('footer:edge:0') && error.includes('outside canvas'),
    ),
    errors.join('\n'),
  );
  assert.ok(
    errors.some((error) => error.includes('label overlap footer:edge:0')),
    errors.join('\n'),
  );
});

test('should reject footer content above its region and edge text wider than its cell', () => {
  const base = layoutDiagram(AUDIT_SPEC);
  const firstLegend = base.footer.legendItems[0];
  const firstEdgeItem = base.footer.edgeItems[0];
  assert.ok(firstLegend && firstEdgeItem);
  const layout: TDiagramLayout = {
    ...base,
    footer: {
      ...base.footer,
      legendItems: [
        {
          ...firstLegend,
          rect: { ...firstLegend.rect, y: 1500 },
        },
        ...base.footer.legendItems.slice(1),
      ],
      edgeItems: [
        {
          ...firstEdgeItem,
          text: {
            ...firstEdgeItem.text,
            rect: { ...firstEdgeItem.text.rect, width: 1 },
          },
        },
        ...base.footer.edgeItems.slice(1),
      ],
    },
  };

  const errors = auditDiagramGeometry(layout);
  assert.ok(
    errors.some(
      (error) =>
        error.includes('footer:legend:0') &&
        error.includes('outside footer region'),
    ),
    errors.join('\n'),
  );
  assert.ok(
    errors.some((error) =>
      error.includes('footer edge text exceeds cell width'),
    ),
    errors.join('\n'),
  );
});

test('should require a unique exact footer entry for every laid-out edge', () => {
  const base = layoutDiagram(AUDIT_SPEC);
  const [firstEdgeItem, secondEdgeItem] = base.footer.edgeItems;
  assert.ok(firstEdgeItem && secondEdgeItem);
  const layout: TDiagramLayout = {
    ...base,
    footer: {
      ...base.footer,
      edgeItems: [
        {
          ...firstEdgeItem,
          code: 'WRONG',
          text: {
            ...firstEdgeItem.text,
            lines: ['WRONG — nội dung bị thay đổi…'],
          },
        },
        { ...secondEdgeItem, edge: firstEdgeItem.edge },
        ...base.footer.edgeItems.slice(2),
      ],
    },
  };

  const errors = auditDiagramGeometry(layout);
  for (const category of [
    'footer code mismatch',
    'footer text mismatch',
    'footer duplicate edge',
    'footer missing edge',
    'footer ellipsis',
  ]) {
    assert.ok(
      errors.some((error) => error.includes(category)),
      `missing ${category}:\n${errors.join('\n')}`,
    );
  }
});

test('should require every local path marker to expose its exact code once', () => {
  const base = layoutDiagram(AUDIT_SPEC);
  const [firstPath] = base.paths;
  assert.ok(firstPath);
  const layout: TDiagramLayout = {
    ...base,
    paths: [
      {
        ...firstPath,
        label: { ...firstPath.label, lines: ['WRONG', 'L1'] },
      },
      ...base.paths.slice(1),
    ],
  };

  const errors = auditDiagramGeometry(layout);
  assert.ok(
    errors.some((error) => error.includes('path marker mismatch')),
    errors.join('\n'),
  );
  assert.ok(
    errors.some((error) => error.includes('path marker exceeds one line')),
    errors.join('\n'),
  );
});

test('should reject perpendicular intersections between different paths', () => {
  const base = layoutDiagram(AUDIT_SPEC);
  const [firstPath, secondPath] = base.paths;
  assert.ok(firstPath && secondPath);
  const layout: TDiagramLayout = {
    ...base,
    paths: [
      {
        ...firstPath,
        segments: [{ from: { x: 200, y: 500 }, to: { x: 600, y: 500 } }],
      },
      {
        ...secondPath,
        segments: [{ from: { x: 400, y: 400 }, to: { x: 400, y: 600 } }],
      },
    ],
  };

  const errors = auditDiagramGeometry(layout);
  assert.ok(
    errors.some((error) => error.includes('path intersection')),
    errors.join('\n'),
  );
});

test('should reject a path segment that crosses a path label or reference chip', () => {
  const base = layoutDiagram(AUDIT_SPEC);
  const [firstPath] = base.paths;
  const [firstReference] = base.references;
  assert.ok(firstPath && firstReference);
  const referenceRect = firstReference.endpoints[0].chipRect;
  const crossingSegment = {
    from: {
      x: referenceRect.x - 12,
      y: referenceRect.y + referenceRect.height / 2,
    },
    to: {
      x: referenceRect.x + referenceRect.width + 12,
      y: referenceRect.y + referenceRect.height / 2,
    },
  };
  const layout: TDiagramLayout = {
    ...base,
    paths: [
      {
        ...firstPath,
        segments: [crossingSegment],
        label: { ...firstPath.label, rect: referenceRect },
      },
      ...base.paths.slice(1),
    ],
  };

  const errors = auditDiagramGeometry(layout);
  assert.ok(
    errors.some(
      (error) =>
        error.includes('path crosses visual') && error.includes('path:0'),
    ),
    errors.join('\n'),
  );
  assert.ok(
    errors.some(
      (error) =>
        error.includes('path crosses visual') && error.includes('reference:'),
    ),
    errors.join('\n'),
  );
});

test('should return every error without mutating deterministic layout metadata', () => {
  const layout = invalidLayout();
  const before = JSON.stringify(layout);
  const first = auditDiagramGeometry(layout);
  const second = auditDiagramGeometry(layout);

  assert.ok(first.length > 10);
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(layout), before);
});

test('should accept all twenty-eight production layouts', () => {
  assert.equal(ALL_SPECS.length, 28);

  for (const productionSpec of ALL_SPECS) {
    assert.deepEqual(
      auditDiagramGeometry(layoutDiagram(productionSpec)),
      [],
      productionSpec.key,
    );
  }
});
