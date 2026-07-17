import assert from 'node:assert/strict';
import test from 'node:test';

import { layoutDiagram } from './diagram-layout.ts';
import { renderDiagram } from './svg-renderer.ts';

import type { TDiagramColumn, TDiagramSpec } from './types.ts';

const FIXTURE: TDiagramSpec = {
  key: 'safe-renderer-fixture',
  title: 'Tổng quan <affiliate> & "bằng chứng"',
  subtitle: 'Luồng Creator đến nền tảng',
  scope: 'CN-001–CN-003 — kiểm thử renderer',
  columns: [
    {
      title: 'Creator & kênh',
      nodes: [
        {
          id: 'creator',
          label: 'Hồ sơ Creator <đã xác minh>',
          detail:
            "Kênh Creator's đã xác minh & toàn bộ tài sản affiliate sẵn sàng để phát hành an toàn",
          tone: 'creator',
          badge: 'Hiện có',
        },
      ],
    },
    {
      title: 'Nền tảng Benadep',
      nodes: [
        {
          id: 'platform',
          label: 'Dịch vụ attribution',
          detail: 'Ghi nhận bằng chứng theo từng dòng đơn hàng',
          tone: 'system',
          badge: 'Mở rộng',
        },
      ],
    },
    {
      title: 'Đối soát',
      nodes: [
        {
          id: 'settlement',
          label: 'Đối soát earning',
          detail: 'Xác nhận earning hợp lệ trước payout',
          tone: 'money',
          badge: 'Mới',
        },
      ],
    },
    {
      title: 'Bằng chứng',
      nodes: [
        {
          id: 'evidence',
          label: 'Audit trail',
          detail: 'Lưu lịch sử quyết định có thể kiểm tra',
          tone: 'ops',
          badge: 'Mở rộng',
        },
      ],
    },
  ],
  edges: [
    {
      from: 'creator',
      to: 'platform',
      label: 'Gửi yêu cầu & điều hướng',
      style: 'solid',
    },
    {
      from: 'platform',
      to: 'settlement',
      label: 'Tiếp tục đối soát',
      style: 'solid',
    },
    {
      from: 'creator',
      to: 'evidence',
      label: 'Lưu audit <evidence>',
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

const elementWithData = (
  svg: string,
  attribute: string,
  value: string,
): string => {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = svg.match(
    new RegExp(
      `<g(?=[^>]*${attribute}="${escapedValue}")[^>]*>[\\s\\S]*?<\\/g>`,
    ),
  );
  assert.ok(match, `missing <g ${attribute}="${value}">`);
  return match[0];
};

const elementWithDataAttributes = (
  svg: string,
  attributes: Readonly<Record<string, string>>,
): string => {
  const lookaheads = Object.entries(attributes)
    .map(([attribute, value]) => {
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return `(?=[^>]*${attribute}="${escapedValue}")`;
    })
    .join('');
  const match = svg.match(new RegExp(`<g${lookaheads}[^>]*>[\\s\\S]*?<\\/g>`));
  assert.ok(
    match,
    `missing <g> with ${Object.entries(attributes)
      .map(([attribute, value]) => `${attribute}="${value}"`)
      .join(' ')}`,
  );
  return match[0];
};

const visibleText = (fragment: string): string =>
  [...fragment.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, ''))
    .join(' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/\s+/g, ' ')
    .trim();

test('should preserve safe semantic SVG metadata and XML escaping', () => {
  const svg = renderDiagram(FIXTURE);

  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /role="img"/);
  assert.match(
    svg,
    /<title id="diagram-title">Tổng quan &lt;affiliate&gt; &amp; &quot;bằng chứng&quot;<\/title>/,
  );
  assert.match(
    svg,
    /<desc id="diagram-desc">Luồng Creator đến nền tảng\. CN-001–CN-003 — kiểm thử renderer\. Các nút:/,
  );
  assert.match(svg, /marker-end="url\(#arrow\)"/);
  assert.match(svg, /Hồ sơ Creator &lt;đã xác minh&gt;/);
  assert.match(svg, /Creator&apos;s đã xác minh &amp;/);
  assert.match(svg, /Lưu audit &lt;evidence&gt;/);

  assert.doesNotMatch(svg, /<script/i);
  assert.doesNotMatch(svg, /javascript:/i);
  assert.doesNotMatch(svg, /<image/i);
  assert.doesNotMatch(svg, /(?:href|xlink:href)\s*=/i);

  const urls = svg.match(/https?:\/\/[^"'\s<]+/g);
  assert.deepEqual(urls, ['http://www.w3.org/2000/svg']);
});

test('should render the portrait 1400 by 1800 canvas', () => {
  assert.match(renderDiagram(FIXTURE), /viewBox="0 0 1400 1800"/);
});

test('should preserve audited coordinates without renderer quantization', () => {
  const fiveColumnFixture: TDiagramSpec = {
    ...FIXTURE,
    key: 'exact-rendered-geometry-fixture',
    columns: Array.from({ length: 5 }, (_, index) => column(`cột-${index}`, 1)),
    edges: [],
  };
  const layout = layoutDiagram(fiveColumnFixture);
  const firstNode = layout.nodes[0];
  assert.ok(firstNode);

  assert.match(
    renderDiagram(fiveColumnFixture),
    new RegExp(`width="${String(firstNode.rect.width).replace('.', '\\.')}"`),
  );
});

test('should expose node and edge semantics in the root accessible description', () => {
  const svg = renderDiagram(FIXTURE);

  assert.match(
    svg,
    /<desc id="diagram-desc">[^<]*Hồ sơ Creator &lt;đã xác minh&gt;[^<]*Gửi yêu cầu &amp; điều hướng[^<]*Lưu audit &lt;evidence&gt;[^<]*<\/desc>/,
  );
});

test('should render exactly two portrait flow bands', () => {
  const svg = renderDiagram(FIXTURE);
  assert.equal((svg.match(/data-band-index=/g) ?? []).length, 2);
  assert.match(svg, /data-band-index="0"/);
  assert.match(svg, /data-band-index="1"/);
});

test('should render the approved portrait typography scale', () => {
  const svg = renderDiagram(FIXTURE);
  assert.match(svg, /font-size="46"/);
  assert.match(svg, /font-size="24"/);
  assert.match(svg, /font-size="22"/);
});

test('should expose local path kind metadata', () => {
  assert.match(renderDiagram(FIXTURE), /data-path-kind="forward-lane"/);
});

test('should expose the stable local path code', () => {
  assert.match(renderDiagram(FIXTURE), /data-edge-code="L1"/);
});

test('should expose paired reference kind and code metadata', () => {
  const svg = renderDiagram(FIXTURE);
  assert.match(svg, /data-reference-kind="handoff"/);
  assert.match(svg, /data-reference-code="①"/);
});

test('should render code-only reference endpoints with accessible titles', () => {
  const svg = renderDiagram(FIXTURE);
  const source = elementWithDataAttributes(svg, {
    'data-reference-code': '①',
    'data-reference-role': 'source',
  });
  const target = elementWithDataAttributes(svg, {
    'data-reference-code': '①',
    'data-reference-role': 'target',
  });

  assert.equal(visibleText(source), '①');
  assert.equal(visibleText(target), '①');
  assert.match(source, /<title>Tiếp tục đối soát<\/title>/);
  assert.match(target, /<title>Tiếp tục đối soát<\/title>/);
});

test('should render one lossless footer directory entry per semantic edge', () => {
  const svg = renderDiagram(FIXTURE);
  const expectedEntries = [
    ['L1', 'L1 — Gửi yêu cầu & điều hướng'],
    ['①', '① — Tiếp tục đối soát'],
    ['E1', 'E1 — Lưu audit <evidence>'],
  ] as const;

  assert.equal(
    (svg.match(/data-edge-directory-code=/g) ?? []).length,
    FIXTURE.edges.length,
  );
  for (const [code, expectedText] of expectedEntries) {
    const entry = elementWithData(svg, 'data-edge-directory-code', code);
    assert.equal(visibleText(entry), expectedText);
  }
});

test('should render the Vietnamese legend and normative warning', () => {
  const svg = renderDiagram(FIXTURE);
  assert.match(svg, />Luồng chính \/ điều hướng</);
  assert.match(svg, />Bất đồng bộ \/ webhook</);
  assert.match(svg, />Audit \/ bằng chứng</);
  assert.match(
    svg,
    />Hình minh họa; nội dung SRS chuẩn tắc vẫn là nguồn quyết định\.</,
  );
});

test('should not retain the English footer legend', () => {
  assert.doesNotMatch(
    renderDiagram(FIXTURE),
    /Visual aid|normative text|request \/ navigation|async \/ webhook|audit \/ evidence/i,
  );
});

test('should never emit renderer-generated ellipsis', () => {
  assert.doesNotMatch(renderDiagram(FIXTURE), /…/);
});

test('should paint paths before nodes and markers before the footer directory', () => {
  const svg = renderDiagram(FIXTURE);
  const pathIndex = svg.indexOf('data-path-kind="forward-lane"');
  const nodeIndex = svg.indexOf('data-node-id="creator"');
  const markerIndex = svg.indexOf('data-reference-role="source"');
  const directoryIndex = svg.indexOf('data-edge-directory-code="L1"');

  assert.ok(pathIndex >= 0, 'missing local path metadata');
  assert.ok(nodeIndex >= 0, 'missing rendered node');
  assert.ok(markerIndex >= 0, 'missing reference endpoint marker');
  assert.ok(directoryIndex >= 0, 'missing footer edge directory');
  assert.ok(pathIndex < nodeIndex, 'paths must render before nodes');
  assert.ok(nodeIndex < markerIndex, 'markers must render after nodes');
  assert.ok(
    markerIndex < directoryIndex,
    'directory must render after markers',
  );
});

test('should reject fewer than two or more than five columns', () => {
  assert.throws(
    () => renderDiagram({ ...FIXTURE, columns: [] }),
    /layoutDiagram requires at least two columns/,
  );
  assert.throws(
    () => renderDiagram({ ...FIXTURE, columns: [column('only', 1)] }),
    /layoutDiagram requires at least two columns/,
  );
  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        columns: Array.from({ length: 6 }, (_, index) =>
          column(`column-${index}`, 1),
        ),
      }),
    /layoutDiagram does not support more than five columns/,
  );
});

test('should reject empty columns and columns with more than four nodes', () => {
  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        columns: [column('empty', 0), column('valid', 1)],
      }),
    /safe-renderer-fixture: column 0 must contain between one and four nodes/,
  );
  assert.throws(
    () =>
      renderDiagram({
        ...FIXTURE,
        columns: [column('crowded', 5), column('valid', 1)],
      }),
    /safe-renderer-fixture: column 0 must contain between one and four nodes/,
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
    /safe-renderer-fixture: edge references unknown node missing/,
  );
});
