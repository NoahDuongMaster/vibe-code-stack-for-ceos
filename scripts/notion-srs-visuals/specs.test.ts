import assert from 'node:assert/strict';
import test from 'node:test';

import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import { renderDiagram } from './svg-renderer.ts';

const EXPECTED_KEYS = [
  'page-1-system-context',
  'page-1-end-to-end',
  'page-4-traceability',
  'page-4-release-gate',
] as const;

const PLACEHOLDER_SENTINELS = ['T' + 'BD', 'TO' + 'DO', 'Lo' + 'rem'];

const flattenNodes = (spec: (typeof OVERVIEW_AND_TEST_SPECS)[number]) =>
  spec.columns.flatMap((column) => column.nodes);

const semanticText = (spec: (typeof OVERVIEW_AND_TEST_SPECS)[number]): string =>
  [
    spec.title,
    spec.subtitle,
    spec.scope,
    ...spec.columns.map((column) => column.title),
    ...flattenNodes(spec).flatMap((node) => [node.label, node.detail]),
    ...spec.edges.flatMap((edge) => [edge.label]),
  ].join(' ');

test('should define the four approved overview and test diagram keys', () => {
  const keys = OVERVIEW_AND_TEST_SPECS.map((spec) => spec.key);

  assert.deepEqual(keys, EXPECTED_KEYS);
  assert.equal(new Set(keys).size, EXPECTED_KEYS.length);
});

test('should connect every edge to a unique declared node without placeholders', () => {
  for (const spec of OVERVIEW_AND_TEST_SPECS) {
    const nodes = flattenNodes(spec);
    const nodeIds = nodes.map((node) => node.id);
    const declaredNodeIds = new Set(nodeIds);

    assert.ok(spec.columns.length > 0, `${spec.key} must declare columns`);
    assert.ok(nodes.length > 0, `${spec.key} must declare nodes`);
    assert.ok(spec.edges.length > 0, `${spec.key} must declare edges`);
    assert.equal(
      declaredNodeIds.size,
      nodeIds.length,
      `${spec.key} must use unique node IDs`,
    );

    for (const edge of spec.edges) {
      assert.ok(
        declaredNodeIds.has(edge.from),
        `${spec.key} edge starts at missing node ${edge.from}`,
      );
      assert.ok(
        declaredNodeIds.has(edge.to),
        `${spec.key} edge ends at missing node ${edge.to}`,
      );
    }

    const text = semanticText(spec);
    for (const sentinel of PLACEHOLDER_SENTINELS) {
      assert.ok(!text.includes(sentinel), `${spec.key} contains ${sentinel}`);
    }
  }
});

test('should render every overview and test spec within renderer limits', () => {
  for (const spec of OVERVIEW_AND_TEST_SPECS) {
    assert.doesNotThrow(() => renderDiagram(spec), `${spec.key} must render`);
  }
});

test('should trace Page 4 from observation to evidence and field validation', () => {
  const traceability = OVERVIEW_AND_TEST_SPECS.find(
    (spec) => spec.key === 'page-4-traceability',
  );
  assert.ok(traceability);

  const text = semanticText(traceability).toLowerCase();
  for (const requiredTerm of [
    'sp',
    'cn',
    'qt',
    'mh',
    'kt',
    'evidence',
    'field-validation',
  ]) {
    assert.ok(
      text.includes(requiredTerm),
      `Page 4 traceability must include ${requiredTerm}`,
    );
  }
});

test('should preserve all six money states in the end-to-end flow', () => {
  const endToEnd = OVERVIEW_AND_TEST_SPECS.find(
    (spec) => spec.key === 'page-1-end-to-end',
  );
  assert.ok(endToEnd);

  const text = semanticText(endToEnd).toLowerCase();
  for (const moneyState of [
    'estimated',
    'approved',
    'payable',
    'paid',
    'held',
    'reversed',
  ]) {
    assert.ok(
      text.includes(moneyState),
      `End-to-end flow must include ${moneyState}`,
    );
  }
});
