import assert from 'node:assert/strict';
import test from 'node:test';

import { BACKEND_SPECS } from './backend-specs.ts';
import {
  layoutDiagram,
  measureVisibleText,
  wrapVisibleText,
} from './diagram-layout.ts';
import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import type { TDiagramColumn, TDiagramEdge, TDiagramSpec } from './types.ts';
import { UI_SPECS } from './ui-specs.ts';

const column = (
  title: string,
  ids: readonly string[],
  detail = 'Nội dung kiểm thử có thể đọc rõ trên Notion.',
): TDiagramColumn => ({
  title,
  nodes: ids.map((id) => ({
    id,
    label: `Nút ${id}`,
    detail,
    tone: 'system' as const,
    badge: 'Mới' as const,
  })),
});

const spec = (
  key: string,
  columns: readonly TDiagramColumn[],
  edges: readonly TDiagramEdge[] = [],
): TDiagramSpec => ({
  key,
  title: 'Sơ đồ kiểm thử bố cục',
  subtitle: 'CN-001–CN-009',
  scope: 'Kiểm tra bố cục dọc hai tầng và toàn vẹn ngữ nghĩa.',
  columns,
  edges,
});

const FOUR_COLUMN_SPEC = spec('four-column-fixture', [
  column('Cột một', ['c0']),
  column('Cột hai', ['c1']),
  column('Cột ba', ['c2']),
  column('Cột bốn', ['c3']),
]);

const FIVE_COLUMN_SPEC = spec('five-column-fixture', [
  column('Cột một', ['c0']),
  column('Cột hai', ['c1']),
  column('Cột ba', ['c2']),
  column('Cột bốn', ['c3']),
  column('Cột năm', ['c4']),
]);

const REFERENCE_GRID_SPEC = spec(
  'reference-grid-fixture',
  [
    column('Nguồn một', ['s0', 's1', 's2', 's3']),
    column('Nguồn hai', ['s4', 's5', 's6', 's7']),
    column('Đích hội tụ', ['target']),
    column('Cột kết', ['tail']),
  ],
  [
    ...Array.from({ length: 8 }, (_, index) => ({
      from: `s${index}`,
      to: 'target',
      label: `bằng chứng hội tụ ${index + 1}`,
      style: 'dotted' as const,
    })),
    {
      from: 'target',
      to: 'tail',
      label: 'bằng chứng phát đi',
      style: 'dotted' as const,
    },
  ],
);

const DENSE_SAME_COLUMN_SPEC = spec(
  'dense-same-column-fixture',
  [
    column('Biên trái', ['left']),
    column('Nguồn dày', ['a0', 'a1', 'a2', 'a3']),
    column('Biên phải', ['right']),
    column('Cột bốn', ['c3']),
    column('Cột năm', ['c4']),
  ],
  [
    { from: 'a0', to: 'a3', label: 'span dày cùng cột', style: 'solid' },
    { from: 'left', to: 'a1', label: 'chặn rail trái', style: 'solid' },
    { from: 'a2', to: 'right', label: 'chặn rail phải', style: 'solid' },
  ],
);

const RIGHT_BLOCKED_SAME_COLUMN_SPEC = spec(
  'right-blocked-same-column-fixture',
  [
    column('Biên trái trống', ['left-free']),
    column('Nguồn giữa', ['m0', 'm1', 'm2']),
    column('Biên phải', ['right-blocked']),
    column('Cột bốn', ['tail-3']),
    column('Cột năm', ['tail-4']),
  ],
  [
    { from: 'm0', to: 'm2', label: 'span cùng cột', style: 'solid' },
    {
      from: 'm1',
      to: 'right-blocked',
      label: 'chặn rail phải',
      style: 'solid',
    },
  ],
);

const rectsIntersect = (
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const containsRect = (
  outer: { x: number; y: number; width: number; height: number },
  inner: { x: number; y: number; width: number; height: number },
): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const CLASSIFICATION_SPEC = spec(
  'classification-fixture',
  [
    column('Cột không', ['c0-a', 'c0-b']),
    column('Cột một', ['c1']),
    column('Cột hai', ['c2']),
    column('Cột ba', ['c3']),
    column('Cột bốn', ['c4']),
  ],
  [
    {
      from: 'c0-a',
      to: 'c1',
      label: 'đi tiếp cục bộ',
      style: 'solid',
    },
    {
      from: 'c0-a',
      to: 'c0-b',
      label: 'đi tiếp cùng cột',
      style: 'solid',
    },
    {
      from: 'c2',
      to: 'c3',
      label: 'tiếp tục sang tầng sau',
      style: 'solid',
    },
    {
      from: 'c0-a',
      to: 'c2',
      label: 'bỏ qua một cột',
      style: 'solid',
    },
    {
      from: 'c2',
      to: 'c1',
      label: 'quay lại an toàn',
      style: 'solid',
    },
    {
      from: 'c1',
      to: 'c2',
      label: 'bằng chứng quyết định',
      style: 'dotted',
    },
    {
      from: 'c0-a',
      to: 'c3',
      label: 'webhook bất đồng bộ',
      style: 'dashed',
    },
  ],
);

const ALL_SPECS = [
  ...OVERVIEW_AND_TEST_SPECS,
  ...BACKEND_SPECS,
  ...UI_SPECS,
] as const satisfies readonly TDiagramSpec[];

test('should split four and five semantic columns into two portrait bands', () => {
  assert.deepEqual(
    layoutDiagram(FOUR_COLUMN_SPEC).bands.map((band) => band.columnIndexes),
    [
      [0, 1],
      [2, 3],
    ],
  );
  assert.deepEqual(
    layoutDiagram(FIVE_COLUMN_SPEC).bands.map((band) => band.columnIndexes),
    [
      [0, 1, 2],
      [3, 4],
    ],
  );
});

test('should expose Notion-readable typography and bounds', () => {
  const layout = layoutDiagram(FIVE_COLUMN_SPEC);

  assert.deepEqual(layout.viewBox, { width: 1400, height: 1800 });
  assert.equal(layout.typography.nodeDetail, 24);
  assert.equal(layout.typography.connector, 22);
  assert.ok(layout.nodes.every((node) => node.title.lines.length <= 2));
  assert.ok(layout.nodes.every((node) => node.detail.lines.length <= 4));
  assert.ok(
    layout.nodes.every((node) => !node.detail.lines.join(' ').includes('…')),
  );
});

test('should reserve disjoint space for every badge and node title', () => {
  const layout = layoutDiagram(FOUR_COLUMN_SPEC);
  for (const node of layout.nodes) {
    assert.ok(node.badge, `${node.node.id}: badge`);
    const badge = node.badge.rect;
    const title = node.title.rect;
    const intersects =
      badge.x < title.x + title.width &&
      badge.x + badge.width > title.x &&
      badge.y < title.y + title.height &&
      badge.y + badge.height > title.y;
    assert.equal(intersects, false, `${node.node.id}: badge/title overlap`);
    assert.ok(badge.x >= node.rect.x && badge.y >= node.rect.y);
    assert.ok(badge.x + badge.width <= node.rect.x + node.rect.width);
    assert.ok(badge.y + badge.height <= node.rect.y + node.rect.height);
  }
});

test('should measure Vietnamese text deterministically across diacritic forms', () => {
  assert.equal(
    measureVisibleText('Đối soát kỳ mở', 24),
    measureVisibleText('Đối soát kỳ mở', 24),
  );
  assert.equal(
    measureVisibleText('Đối soát kỳ mở', 24),
    measureVisibleText('Đối soát kỳ mở', 24),
  );
  assert.ok(measureVisibleText('Đối soát kỳ mở', 24) > 0);
});

test('should wrap a long source path without losing characters', () => {
  const value = 'apps/storefront/src/app/mcn/*';
  const lines = wrapVisibleText(value, 180, 24);

  assert.equal(lines.join(''), value);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((line) => measureVisibleText(line, 24) <= 180));
  assert.ok(lines.every((line) => !line.includes('…')));
});

test('should draw only local forward and same-column edges', () => {
  const layout = layoutDiagram(CLASSIFICATION_SPEC);

  assert.deepEqual(
    layout.paths.map((path) => path.kind),
    ['forward-lane', 'same-column-rail'],
  );
  assert.equal(
    new Set(layout.paths.map((path) => path.lane)).size,
    layout.paths.length,
  );
  assert.deepEqual(
    layout.paths.map((path) => ({ code: path.code, label: path.label.lines })),
    [
      { code: 'L1', label: ['L1'] },
      { code: 'L2', label: ['L2'] },
    ],
  );
});

test('should convert non-local connections into paired references', () => {
  const layout = layoutDiagram(CLASSIFICATION_SPEC);

  assert.deepEqual(
    layout.references.map((reference) => ({
      kind: reference.kind,
      code: reference.code,
      endpoints: reference.endpoints.length,
    })),
    [
      { kind: 'handoff', code: '①', endpoints: 2 },
      { kind: 'jump', code: 'N1', endpoints: 2 },
      { kind: 'return', code: 'R1', endpoints: 2 },
      { kind: 'evidence', code: 'E1', endpoints: 2 },
      { kind: 'async', code: 'A1', endpoints: 2 },
    ],
  );

  for (const reference of layout.references) {
    const [source, target] = reference.endpoints;
    assert.equal(source.role, 'source');
    assert.equal(target.role, 'target');
    assert.equal(source.nodeId, reference.edge.from);
    assert.equal(target.nodeId, reference.edge.to);
    assert.deepEqual(source.label.lines, [reference.code]);
    assert.deepEqual(target.label.lines, [reference.code]);
  }
});

test('should fallback only a proven non-planar same-column span to S reference', () => {
  const layout = layoutDiagram(DENSE_SAME_COLUMN_SPEC);

  assert.deepEqual(
    layout.references.map((reference) => ({
      edge: `${reference.edge.from}->${reference.edge.to}`,
      kind: reference.kind,
      code: reference.code,
    })),
    [
      {
        edge: 'a0->a3',
        kind: 'same-column-reference',
        code: 'S1',
      },
    ],
  );
  assert.deepEqual(
    layout.paths.map((path) => `${path.edge.from}->${path.edge.to}`),
    ['left->a1', 'a2->right'],
  );
  assert.equal(
    layoutDiagram(CLASSIFICATION_SPEC).paths.some(
      (path) => path.kind === 'same-column-rail',
    ),
    true,
  );
});

test('should try the left rail when an interior same-column right rail is blocked', () => {
  const layout = layoutDiagram(RIGHT_BLOCKED_SAME_COLUMN_SPEC);
  const sameColumnPath = layout.paths.find(
    (path) => path.edge.from === 'm0' && path.edge.to === 'm2',
  );

  assert.ok(sameColumnPath);
  assert.equal(sameColumnPath.kind, 'same-column-rail');
  assert.match(sameColumnPath.lane, /^b0:g:0:1:/u);
  assert.equal(
    layout.references.some(
      (reference) => reference.edge.from === 'm0' && reference.edge.to === 'm2',
    ),
    false,
  );
});

test('should pack disjoint references inside the owner node with sources first', () => {
  const first = layoutDiagram(REFERENCE_GRID_SPEC);
  const second = layoutDiagram(REFERENCE_GRID_SPEC);
  assert.deepEqual(second.references, first.references);

  const nodeById = new Map(first.nodes.map((node) => [node.node.id, node]));
  const controlsByNode = new Map<
    string,
    {
      role: 'source' | 'target';
      rect: { x: number; y: number; width: number; height: number };
    }[]
  >();
  for (const reference of first.references) {
    const [source, target] = reference.endpoints;
    assert.deepEqual(source.label.lines, [reference.code]);
    assert.deepEqual(target.label.lines, [reference.code]);

    for (const endpoint of reference.endpoints) {
      const owner = nodeById.get(endpoint.nodeId);
      assert.ok(owner, endpoint.nodeId);
      assert.ok(containsRect(owner.rect, endpoint.chipRect));
      assert.ok(containsRect(endpoint.chipRect, endpoint.label.rect));
      assert.equal(rectsIntersect(endpoint.chipRect, owner.title.rect), false);
      assert.equal(rectsIntersect(endpoint.chipRect, owner.detail.rect), false);
      if (owner.badge) {
        assert.equal(
          rectsIntersect(endpoint.chipRect, owner.badge.rect),
          false,
        );
      }
      for (const candidate of first.nodes) {
        if (candidate.node.id === endpoint.nodeId) {
          continue;
        }
        assert.equal(
          rectsIntersect(endpoint.chipRect, candidate.rect),
          false,
          `${endpoint.nodeId}: marker must not overlap ${candidate.node.id}`,
        );
      }
      const controls = controlsByNode.get(endpoint.nodeId) ?? [];
      assert.ok(
        controls.every(
          (control) => !rectsIntersect(control.rect, endpoint.chipRect),
        ),
        `${endpoint.nodeId}: reference controls must be disjoint`,
      );
      controls.push({ role: endpoint.role, rect: endpoint.chipRect });
      controlsByNode.set(endpoint.nodeId, controls);
    }
  }

  for (const [nodeId, controls] of controlsByNode) {
    const rowMajor = [...controls].sort(
      (left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x,
    );
    const rows = new Map<number, typeof controls>();
    for (const control of rowMajor) {
      const row = rows.get(control.rect.y) ?? [];
      row.push(control);
      rows.set(control.rect.y, row);
    }
    assert.ok(
      [...rows.values()].every((row) => row.length <= 4),
      `${nodeId}: max four chips per row`,
    );
    const firstTarget = rowMajor.findIndex(
      (control) => control.role === 'target',
    );
    const lastSource = rowMajor.findLastIndex(
      (control) => control.role === 'source',
    );
    if (firstTarget >= 0 && lastSource >= 0) {
      assert.ok(lastSource < firstTarget, `${nodeId}: sources before targets`);
    }
  }
  assert.equal(controlsByNode.get('target')?.length, 9);
});

test('should list every full edge label exactly once in a four-column footer directory', () => {
  const layout = layoutDiagram(CLASSIFICATION_SPEC);
  assert.equal(
    layout.footer.edgeItems.length,
    CLASSIFICATION_SPEC.edges.length,
  );
  assert.ok(layout.footer.edgeItems.length <= 24);
  assert.deepEqual(
    layout.footer.edgeItems.map((item) => item.text.lines.join('')),
    CLASSIFICATION_SPEC.edges.map((edge) => {
      const path = layout.paths.find((item) => item.edge === edge);
      const reference = layout.references.find((item) => item.edge === edge);
      return `${path?.code ?? reference?.code} — ${edge.label}`;
    }),
  );
  assert.ok(
    layout.footer.edgeItems.every((item) => item.text.lines.length === 1),
  );
  assert.ok(
    new Set(layout.footer.edgeItems.map((item) => item.text.rect.x)).size <= 4,
  );
  assert.ok(
    new Set(layout.footer.edgeItems.map((item) => item.text.rect.y)).size <= 6,
  );
});

test('should prioritize semantic edge style before positional classification', () => {
  const prioritySpec = spec(
    'semantic-priority-fixture',
    [
      column('Cột không', ['p0-a', 'p0-b']),
      column('Cột một', ['p1']),
      column('Cột hai', ['p2']),
      column('Cột ba', ['p3']),
    ],
    [
      {
        from: 'p0-a',
        to: 'p0-b',
        label: 'bằng chứng cùng cột',
        style: 'dotted',
      },
      {
        from: 'p2',
        to: 'p3',
        label: 'bằng chứng khác tầng',
        style: 'dotted',
      },
      {
        from: 'p1',
        to: 'p0-a',
        label: 'bất đồng bộ quay lại',
        style: 'dashed',
      },
      {
        from: 'p0-a',
        to: 'p1',
        label: 'bất đồng bộ cục bộ',
        style: 'dashed',
      },
    ],
  );
  const layout = layoutDiagram(prioritySpec);

  assert.deepEqual(
    layout.references.map((reference) => reference.kind),
    ['evidence', 'evidence', 'async'],
  );
  assert.deepEqual(
    layout.paths.map((path) => path.kind),
    ['forward-lane'],
  );
});

test('should allocate distinct local anchor ports and reference endpoints', () => {
  const layout = layoutDiagram(CLASSIFICATION_SPEC);
  const sourcePoints = layout.paths.map((path) => path.segments[0]?.from);
  const referenceEndpoints = layout.references
    .flatMap((reference) => reference.endpoints)
    .filter((endpoint) => endpoint.nodeId === 'c0-a');

  assert.equal(
    new Set(sourcePoints.map((point) => `${point?.x}:${point?.y}`)).size,
    sourcePoints.length,
  );
  assert.equal(
    new Set(
      referenceEndpoints.map(
        (endpoint) =>
          `${endpoint.chipRect.x}:${endpoint.chipRect.y}:${endpoint.chipRect.width}:${endpoint.chipRect.height}`,
      ),
    ).size,
    referenceEndpoints.length,
  );
});

test('should grow node rectangles for wrapped content', () => {
  const shortLayout = layoutDiagram(FOUR_COLUMN_SPEC);
  const longLayout = layoutDiagram(
    spec('dynamic-height-fixture', [
      column(
        'Cột nội dung dài',
        ['long'],
        'Nội dung dài được ngắt thành nhiều dòng rõ ràng để chiều cao của nút tăng theo nội dung thực tế và tiếp tục phản ánh đầy đủ yêu cầu chuẩn tắc trong sơ đồ này. Không cắt bỏ nội dung.',
      ),
      column('Cột đích', ['target']),
      column('Cột ba', ['third']),
      column('Cột bốn', ['fourth']),
    ]),
  );

  assert.ok(longLayout.nodes[0].rect.height > shortLayout.nodes[0].rect.height);
  assert.ok(longLayout.nodes[0].rect.height >= 128);
});

test('should reject unsupported columns and visible-copy overflow', () => {
  const sixColumns = spec(
    'six-column-fixture',
    Array.from({ length: 6 }, (_, index) =>
      column(`Cột ${index}`, [`node-${index}`]),
    ),
  );
  const detailOverflow = spec('detail-overflow-fixture', [
    column(
      'Cột nguồn',
      ['overflow'],
      'Một chuỗi nội dung rất dài không thể vừa trong bốn dòng vì nó chủ ý lặp lại nhiều yêu cầu chi tiết để chứng minh layout phải dừng thay vì cắt nội dung hoặc tự ý thêm dấu ba chấm làm mất ý nghĩa chuẩn tắc.',
    ),
    column('Cột đích', ['target']),
    column('Cột ba', ['third']),
    column('Cột bốn', ['fourth']),
    column('Cột năm', ['fifth']),
  ]);

  assert.throws(() => layoutDiagram(sixColumns), /more than five columns/i);
  assert.throws(() => layoutDiagram(detailOverflow), /detail.*four lines/i);
});

test('should reject unbounded node, edge and local-gutter search inputs early', () => {
  const emptyColumn = spec('empty-column-bound-fixture', [
    column('Cột trống', []),
    column('Cột hai', ['empty-c1']),
  ]);
  const fiveNodeColumn = spec('five-node-bound-fixture', [
    column('Cột quá dày', ['n0', 'n1', 'n2', 'n3', 'n4']),
    column('Cột hai', ['five-c1']),
  ]);
  const twentyFiveEdges = spec(
    'edge-count-bound-fixture',
    [column('Nguồn', ['edge-source']), column('Đích', ['edge-target'])],
    Array.from({ length: 25 }, (_, index) => ({
      from: 'edge-source',
      to: 'edge-target',
      label: `bằng chứng ${index + 1}`,
      style: 'dotted' as const,
    })),
  );
  const sixPathsOneGutter = spec(
    'local-gutter-bound-fixture',
    [
      column('Nguồn', ['g-a0', 'g-a1', 'g-a2', 'g-a3']),
      column('Đích', ['g-b0', 'g-b1', 'g-b2', 'g-b3']),
      column('Cột ba', ['g-c0']),
      column('Cột bốn', ['g-d0']),
    ],
    [
      { from: 'g-a0', to: 'g-b0', label: 'luồng 1', style: 'solid' },
      { from: 'g-a0', to: 'g-b1', label: 'luồng 2', style: 'solid' },
      { from: 'g-a1', to: 'g-b1', label: 'luồng 3', style: 'solid' },
      { from: 'g-a1', to: 'g-b2', label: 'luồng 4', style: 'solid' },
      { from: 'g-a2', to: 'g-b2', label: 'luồng 5', style: 'solid' },
      { from: 'g-a3', to: 'g-b3', label: 'luồng 6', style: 'solid' },
    ],
  );

  assert.throws(
    () => layoutDiagram(emptyColumn),
    /between one and four nodes/i,
  );
  assert.throws(
    () => layoutDiagram(fiveNodeColumn),
    /between one and four nodes/i,
  );
  assert.throws(
    () => layoutDiagram(twentyFiveEdges),
    /at most twenty-four edges/i,
  );
  assert.throws(
    () => layoutDiagram(sixPathsOneGutter),
    /at most five local paths per gutter/i,
  );
});

test('should layout every production diagram without dropping an edge', () => {
  assert.equal(ALL_SPECS.length, 28);

  for (const productionSpec of ALL_SPECS) {
    const before = JSON.stringify(productionSpec);
    const layout = layoutDiagram(productionSpec);
    assert.deepEqual(
      layoutDiagram(productionSpec),
      layout,
      `${productionSpec.key} must be deterministic`,
    );
    assert.equal(
      JSON.stringify(productionSpec),
      before,
      `${productionSpec.key} must not mutate its semantic spec`,
    );
    for (const [
      columnIndex,
      semanticColumn,
    ] of productionSpec.columns.entries()) {
      if (semanticColumn.allowVisualReorder) {
        continue;
      }
      assert.deepEqual(
        layout.nodes
          .filter((node) => node.columnIndex === columnIndex)
          .sort((left, right) => left.rect.y - right.rect.y)
          .map((node) => node.node.id),
        semanticColumn.nodes.map((node) => node.id),
        `${productionSpec.key} column ${columnIndex} must preserve semantic order`,
      );
    }
    const laidOutEdges = [
      ...layout.paths.map((path) => path.edge),
      ...layout.references.map((reference) => reference.edge),
    ];

    assert.equal(
      laidOutEdges.length,
      productionSpec.edges.length,
      `${productionSpec.key} must preserve every edge`,
    );
    assert.equal(
      layout.nodes.length,
      productionSpec.columns.flatMap((item) => item.nodes).length,
      `${productionSpec.key} must preserve every node`,
    );
  }
});
