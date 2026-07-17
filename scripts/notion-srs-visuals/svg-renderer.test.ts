import assert from 'node:assert/strict';
import test from 'node:test';

import { renderDiagram } from './svg-renderer.ts';

import type { TDiagramColumn, TDiagramSpec } from './types.ts';

const FIXTURE: TDiagramSpec = {
  key: 'safe-renderer-fixture',
  title: 'Affiliate <overview> & "evidence"',
  subtitle: 'Creator to platform flow',
  scope: 'CN-001–CN-003',
  columns: [
    {
      title: 'Creator & channel',
      nodes: [
        {
          id: 'creator',
          label: 'Creator <profile>',
          detail: "Creator's verified channel & affiliate assets",
          tone: 'creator',
          badge: 'Existing',
        },
      ],
    },
    {
      title: 'Benadep platform',
      nodes: [
        {
          id: 'platform',
          label: 'Attribution service',
          detail: 'Records order-line evidence',
          tone: 'system',
          badge: 'Extend',
        },
      ],
    },
  ],
  edges: [
    {
      from: 'creator',
      to: 'platform',
      label: 'request & navigation',
      style: 'solid',
    },
    {
      from: 'creator',
      to: 'platform',
      label: 'async <event>',
      style: 'dashed',
    },
    {
      from: 'creator',
      to: 'platform',
      label: 'audit "evidence"',
      style: 'dotted',
    },
  ],
};

const column = (title: string, nodeCount: number): TDiagramColumn => ({
  title,
  nodes: Array.from({ length: nodeCount }, (_, index) => ({
    id: `${title}-${index}`,
    label: `Node ${index}`,
    detail: 'Validation fixture',
    tone: 'system' as const,
  })),
});

type TRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const nodeRect = (svg: string, nodeId: string): TRect => {
  const match = svg.match(
    new RegExp(
      `<g data-node-id="${nodeId}"><rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"`,
    ),
  );
  assert.ok(match, `missing rendered node ${nodeId}`);

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
  };
};

const edgePath = (
  svg: string,
  from: string,
  to: string,
): { route: string; path: string } => {
  const match = svg.match(
    new RegExp(
      `<path data-edge-from="${from}" data-edge-to="${to}" data-route="([^"]+)" d="([^"]+)"`,
    ),
  );
  assert.ok(match, `missing rendered edge ${from} -> ${to}`);

  return { route: match[1], path: match[2] };
};

const edgeLabelRect = (svg: string, from: string, to: string): TRect => {
  const match = svg.match(
    new RegExp(
      `<g data-edge-label="true" data-edge-from="${from}" data-edge-to="${to}">[\\s\\S]*?<rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"`,
    ),
  );
  assert.ok(match, `missing rendered edge label ${from} -> ${to}`);

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
  };
};

const intersects = (left: TRect, right: TRect): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

test('should render a safe semantic SVG with all approved edge styles', () => {
  const svg = renderDiagram(FIXTURE);

  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 1600 900"/);
  assert.match(svg, /<title id="diagram-title">/);
  assert.match(svg, /<desc id="diagram-desc">/);
  assert.match(svg, /marker-end="url\(#arrow\)"/);
  assert.match(svg, /stroke-dasharray="12 8"/);
  assert.match(svg, /stroke-dasharray="3 8"/);
  assert.match(svg, /Affiliate &lt;overview&gt; &amp; &quot;evidence&quot;/);
  assert.match(svg, /Creator&apos;s verified channel &amp;/);
  assert.match(svg, /affiliate assets/);
  assert.match(svg, /async &lt;event&gt;/);

  assert.doesNotMatch(svg, /<script/i);
  assert.doesNotMatch(svg, /javascript:/i);
  assert.doesNotMatch(svg, /<image/i);
  assert.doesNotMatch(svg, /(?:href|xlink:href)\s*=/i);

  const urls = svg.match(/https?:\/\/[^"'\s<]+/g);
  assert.deepEqual(urls, ['http://www.w3.org/2000/svg']);
});

test('should reserve a readable immediate label lane and paint a wrapped pill above nodes', () => {
  const svg = renderDiagram({
    ...FIXTURE,
    key: 'edge-label-layout-fixture',
    columns: [
      column('source', 1),
      column('intermediate', 1),
      column('destination', 1),
    ],
    edges: [
      {
        from: 'source-0',
        to: 'destination-0',
        label: 'submit verified affiliate application',
        style: 'solid',
      },
    ],
  });
  const nodeRects = [
    ...svg.matchAll(
      /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="112" rx="16"/g,
    ),
  ];
  const firstNode = nodeRects[0];
  const secondNode = nodeRects[1];
  assert.ok(firstNode && secondNode);

  const laneLeft = Number(firstNode[1]) + Number(firstNode[2]);
  const laneRight = Number(secondNode[1]);
  const labelGroup = svg.match(
    /<g data-edge-label="true"[^>]*>([\s\S]*?)<\/g>/,
  );
  const labelPill = labelGroup?.[1].match(
    /<rect x="([\d.]+)"[^>]*width="([\d.]+)"[^>]*rx="10"[^>]*fill="#FFFFFF"/,
  );
  const pillLeft = Number(labelPill?.[1] ?? Number.NaN);
  const pillRight = pillLeft + Number(labelPill?.[2] ?? Number.NaN);
  const wrappedLineCount = labelGroup?.[1].match(/<tspan\b/g)?.length ?? 0;

  assert.deepEqual(
    {
      hasReadableLane: laneRight - laneLeft >= 96,
      hasVisiblePill: Boolean(labelPill),
      labelUsesImmediateLane: pillLeft >= laneLeft && pillRight <= laneRight,
      paintedAfterNodes:
        svg.indexOf('<g data-edge-label="true"') >
        svg.lastIndexOf('height="112" rx="16"'),
      wrappedLineCount,
    },
    {
      hasReadableLane: true,
      hasVisiblePill: true,
      labelUsesImmediateLane: true,
      paintedAfterNodes: true,
      wrappedLineCount: 2,
    },
  );
});

test('should route a same-column edge vertically outside both node rectangles', () => {
  const svg = renderDiagram({
    ...FIXTURE,
    key: 'same-column-routing-fixture',
    columns: [column('source', 2), column('adjacent', 1)],
    edges: [
      {
        from: 'source-0',
        to: 'source-1',
        label: 'continue vertically',
        style: 'solid',
      },
    ],
  });
  const source = nodeRect(svg, 'source-0');
  const target = nodeRect(svg, 'source-1');
  const adjacent = nodeRect(svg, 'adjacent-0');
  const edge = edgePath(svg, 'source-0', 'source-1');
  const label = edgeLabelRect(svg, 'source-0', 'source-1');
  const coordinates = edge.path.match(/[\d.]+/g)?.map(Number) ?? [];
  const sourceRight = source.x + source.width;

  assert.equal(edge.route, 'same-column');
  assert.match(
    edge.path,
    /^M [\d.]+ [\d.]+ C [\d.]+ [\d.]+, [\d.]+ [\d.]+, [\d.]+ [\d.]+$/,
  );
  assert.equal(coordinates[0], sourceRight);
  assert.equal(coordinates.at(-2), target.x + target.width);
  assert.ok(coordinates[2] > sourceRight);
  assert.ok(coordinates[4] > sourceRight);
  assert.ok(label.x >= sourceRight);
  assert.ok(label.x + label.width <= adjacent.x);
  assert.equal(intersects(label, source), false);
  assert.equal(intersects(label, target), false);
});

test('should keep an adjacent back-edge path and label inside the shared column gap', () => {
  const svg = renderDiagram({
    ...FIXTURE,
    key: 'adjacent-back-edge-routing-fixture',
    columns: [column('destination', 1), column('source', 1)],
    edges: [
      {
        from: 'source-0',
        to: 'destination-0',
        label: 'return safely',
        style: 'solid',
      },
    ],
  });
  const destination = nodeRect(svg, 'destination-0');
  const source = nodeRect(svg, 'source-0');
  const edge = edgePath(svg, 'source-0', 'destination-0');
  const label = edgeLabelRect(svg, 'source-0', 'destination-0');
  const coordinates = edge.path.match(/[\d.]+/g)?.map(Number) ?? [];
  const gapLeft = destination.x + destination.width;
  const gapRight = source.x;

  assert.equal(edge.route, 'back-adjacent');
  assert.equal(coordinates[0], gapRight);
  assert.equal(coordinates.at(-2), gapLeft);
  assert.ok(coordinates[2] > gapLeft && coordinates[2] < gapRight);
  assert.ok(coordinates[4] > gapLeft && coordinates[4] < gapRight);
  assert.ok(label.x >= gapLeft);
  assert.ok(label.x + label.width <= gapRight);
  assert.equal(intersects(label, destination), false);
  assert.equal(intersects(label, source), false);
});

test('should route a spanning back edge below intermediate nodes with its label', () => {
  const svg = renderDiagram({
    ...FIXTURE,
    key: 'spanning-back-edge-routing-fixture',
    columns: [
      column('destination', 1),
      column('intermediate', 1),
      column('source', 1),
    ],
    edges: [
      {
        from: 'source-0',
        to: 'destination-0',
        label: 'return with evidence',
        style: 'dotted',
      },
    ],
  });
  const nodes = [
    nodeRect(svg, 'destination-0'),
    nodeRect(svg, 'intermediate-0'),
    nodeRect(svg, 'source-0'),
  ];
  const edge = edgePath(svg, 'source-0', 'destination-0');
  const label = edgeLabelRect(svg, 'source-0', 'destination-0');
  const coordinates = edge.path.match(/[\d.]+/g)?.map(Number) ?? [];
  const maximumNodeBottom = Math.max(
    ...nodes.map((node) => node.y + node.height),
  );
  const routeY = coordinates[3];

  assert.equal(edge.route, 'back-exterior');
  assert.match(
    edge.path,
    /^M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+ H [\d.]+ V [\d.]+ H [\d.]+$/,
  );
  assert.ok(routeY > maximumNodeBottom);
  assert.ok(label.y > maximumNodeBottom);
  assert.ok(label.y + label.height < 820);
  for (const node of nodes) {
    assert.equal(intersects(label, node), false);
  }
});

test('should reject fewer than two or more than five columns', () => {
  assert.throws(
    () => renderDiagram({ ...FIXTURE, columns: [] }),
    /safe-renderer-fixture: expected 2–5 columns/,
  );
  assert.throws(
    () => renderDiagram({ ...FIXTURE, columns: [column('only', 1)] }),
    /safe-renderer-fixture: expected 2–5 columns/,
  );
  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        columns: Array.from({ length: 6 }, (_, index) =>
          column(`column-${index}`, 1),
        ),
      }),
    /safe-renderer-fixture: expected 2–5 columns/,
  );
});

test('should reject empty columns and columns with more than four nodes', () => {
  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        columns: [column('empty', 0), column('valid', 1)],
      }),
    /safe-renderer-fixture: every column needs 1–4 nodes/,
  );
  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        columns: [column('crowded', 5), column('valid', 1)],
      }),
    /safe-renderer-fixture: every column needs 1–4 nodes/,
  );
});

test('should reject duplicate node IDs', () => {
  const duplicate = {
    id: 'duplicate',
    label: 'Duplicate node',
    detail: 'Validation fixture',
    tone: 'system' as const,
  };

  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        columns: [
          { title: 'First', nodes: [duplicate] },
          { title: 'Second', nodes: [duplicate] },
        ],
      }),
    /safe-renderer-fixture: duplicate node duplicate/,
  );
});

test('should reject edges with unknown endpoints', () => {
  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        edges: [
          {
            from: 'creator',
            to: 'missing',
            label: 'invalid edge',
            style: 'solid',
          },
        ],
      }),
    /safe-renderer-fixture: unknown edge creator → missing/,
  );
});
