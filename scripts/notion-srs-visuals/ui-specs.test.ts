import assert from 'node:assert/strict';
import test from 'node:test';

import { DIAGRAM_TARGETS } from './manifest.ts';
import { renderDiagram } from './svg-renderer.ts';
import { UI_SPECS } from './ui-specs.ts';

const EXPECTED_KEYS = Array.from(
  { length: 12 },
  (_, index) => `3-${String(index + 1).padStart(2, '0')}-ui`,
);

const REQUIRED_PRIMARY_EDGES: Readonly<
  Record<string, readonly (readonly [string, string])[]>
> = {
  '3-01-ui': [
    ['mh-001', 'mh-002'],
    ['mh-002', 'mh-003'],
    ['mh-003', 'mh-004'],
  ],
  '3-02-ui': [
    ['mh-006', 'mh-007'],
    ['mh-007', 'mh-008'],
  ],
  '3-03-ui': [['mh-016', 'mh-017']],
  '3-04-ui': [
    ['mh-018', 'mh-020'],
    ['mh-018', 'mh-021'],
  ],
  '3-05-ui': [
    ['mh-022', 'mh-025'],
    ['mh-023', 'mh-024'],
  ],
  '3-06-ui': [
    ['mh-027', 'mh-030'],
    ['mh-028', 'mh-029'],
  ],
  '3-07-ui': [
    ['mh-032', 'mh-033'],
    ['mh-033', 'mh-034'],
  ],
  '3-08-ui': [
    ['mh-036', 'mh-037'],
    ['mh-037', 'mh-038'],
    ['mh-038', 'mh-039'],
  ],
  '3-09-ui': [
    ['mh-041', 'mh-042'],
    ['mh-042', 'mh-043'],
    ['mh-043', 'mh-044'],
    ['mh-044', 'mh-045'],
  ],
  '3-10-ui': [
    ['mh-046', 'mh-047'],
    ['mh-047', 'mh-048'],
  ],
  '3-11-ui': [
    ['mh-051', 'mh-052'],
    ['mh-052', 'mh-053'],
  ],
  '3-12-ui': [
    ['mh-056', 'mh-057'],
    ['mh-057', 'mh-058'],
    ['mh-058', 'mh-059'],
  ],
};

const BRANCH_REQUIREMENTS: Readonly<Record<string, readonly RegExp[]>> = {
  '3-01-ui': [
    /admin deep-link/i,
    /needs_action|rejected/i,
    /exact form section/i,
  ],
  '3-02-ui': [
    /invitation deep-link/i,
    /referral/i,
    /stale offer/i,
    /version refresh/i,
  ],
  '3-03-ui': [
    /link or code or collection/i,
    /resolver error/i,
    /source context/i,
  ],
  '3-04-ui': [
    /seller config/i,
    /admin evidence/i,
    /permission denied/i,
    /safe exit/i,
  ],
  '3-05-ui': [/create/i, /publish/i, /enforcement/i, /appeal/i],
  '3-06-ui': [/host/i, /reconnect/i, /ended/i, /replay|enforcement/i],
  '3-07-ui': [
    /internal chat/i,
    /revoked consent/i,
    /hides contact/i,
    /preserves chat/i,
  ],
  '3-08-ui': [
    /release/i,
    /seller affiliate/i,
    /revision|dispute/i,
    /immutable contract version/i,
  ],
  '3-09-ui': [/leave|revoke/i, /effective membership/i, /permissions/i],
  '3-10-ui': [
    /notification deep-link/i,
    /finance role/i,
    /held|failed/i,
    /safe action/i,
  ],
  '3-11-ui': [/destructive action/i, /confirm/i, /return reference/i],
  '3-12-ui': [/disconnect|reconnect/i, /preserves history/i, /safe status/i],
};

const specText = (spec: (typeof UI_SPECS)[number]): string =>
  [
    spec.title,
    spec.subtitle,
    spec.scope,
    ...spec.columns.flatMap((column) => [
      column.title,
      ...column.nodes.flatMap((node) => [node.label, node.detail]),
    ]),
    ...spec.edges.flatMap((edge) => [edge.label]),
  ].join(' ');

test('should define exactly the twelve approved UI diagram keys', () => {
  assert.deepEqual(
    UI_SPECS.map((spec) => spec.key),
    EXPECTED_KEYS,
  );
  assert.equal(new Set(UI_SPECS.map((spec) => spec.key)).size, 12);
});

test('should represent every manifest MH exactly once as a primary node', () => {
  for (const spec of UI_SPECS) {
    const target = DIAGRAM_TARGETS.find((item) => item.key === spec.key);
    assert.ok(target, `${spec.key}: missing manifest target`);
    const range = target.codeRange.match(/^MH-(\d{3})–MH-(\d{3})$/);
    assert.ok(range, `${spec.key}: invalid manifest MH range`);

    const first = Number(range[1]);
    const last = Number(range[2]);
    const expected = Array.from(
      { length: last - first + 1 },
      (_, index) => `MH-${String(first + index).padStart(3, '0')}`,
    );
    const primary = spec.columns
      .flatMap((column) => column.nodes)
      .map((node) => node.label.match(/^(MH-\d{3})\b/)?.[1])
      .filter((code): code is string => code !== undefined);

    assert.deepEqual(
      primary.sort(),
      expected,
      `${spec.key}: primary MH coverage`,
    );
  }
});

test('should keep every UI spec within renderer layout limits and render it', () => {
  for (const spec of UI_SPECS) {
    assert.ok(spec.columns.length >= 2 && spec.columns.length <= 5, spec.key);
    assert.ok(
      spec.columns.every(
        (column) => column.nodes.length >= 1 && column.nodes.length <= 4,
      ),
      `${spec.key}: each column must contain 1–4 nodes`,
    );
    assert.match(renderDiagram(spec), /^<svg /, `${spec.key}: renderable SVG`);
  }
});

test('should expose surface entry, authoritative API states, and a safe outcome', () => {
  for (const spec of UI_SPECS) {
    const surfaceColumn = spec.columns.find((column) =>
      /surface boundary/i.test(column.title),
    );
    assert.ok(surfaceColumn, `${spec.key}: separate surface boundary column`);
    assert.match(
      surfaceColumn.nodes
        .map((node) => `${node.label} ${node.detail}`)
        .join(' '),
      /entry\/auth/i,
      `${spec.key}: entry/auth`,
    );

    const outcomeText = spec.columns
      .at(-1)
      ?.nodes.map((node) => `${node.label} ${node.detail}`)
      .join(' ');
    assert.ok(outcomeText, `${spec.key}: final outcome column`);
    assert.match(outcomeText, /BFF\/API authoritative result/i, spec.key);
    assert.match(outcomeText, /loading/i, spec.key);
    assert.match(outcomeText, /error/i, spec.key);
    assert.match(outcomeText, /denied/i, spec.key);
    assert.match(outcomeText, /remediation|safe exit/i, spec.key);
    assert.match(outcomeText, /audit|reference/i, spec.key);
  }
});

test('should preserve the approved primary navigation and branch annotations', () => {
  for (const spec of UI_SPECS) {
    const edges = new Set(spec.edges.map((edge) => `${edge.from}->${edge.to}`));
    for (const [from, to] of REQUIRED_PRIMARY_EDGES[spec.key] ?? []) {
      assert.ok(edges.has(`${from}->${to}`), `${spec.key}: ${from} -> ${to}`);
    }

    const text = specText(spec);
    for (const requirement of BRANCH_REQUIREMENTS[spec.key] ?? []) {
      assert.match(text, requirement, `${spec.key}: ${requirement}`);
    }
  }
});

test('should keep responsive web outside Video and LIVE native parity closure', () => {
  for (const key of ['3-05-ui', '3-06-ui']) {
    const spec = UI_SPECS.find((item) => item.key === key);
    assert.ok(spec, `${key}: missing spec`);
    const nativeGate = spec.columns
      .flatMap((column) => column.nodes)
      .find((node) => node.label === 'Native gate');

    assert.ok(nativeGate, `${key}: Native gate node`);
    assert.match(
      nativeGate.detail,
      /responsive web does not close (?:native )?parity/i,
      `${key}: responsive web is not closure evidence`,
    );
  }
});

test('should connect every surface, state, remediation, and native gate to a meaningful transition', () => {
  for (const spec of UI_SPECS) {
    const connectedNodeIds = new Set(
      spec.edges.flatMap((diagramEdge) => [diagramEdge.from, diagramEdge.to]),
    );
    const surfaceNodeIds =
      spec.columns
        .find((diagramColumn) => /surface boundary/i.test(diagramColumn.title))
        ?.nodes.map((diagramNode) => diagramNode.id) ?? [];
    const requiredNodeIds = spec.columns
      .flatMap((diagramColumn) => diagramColumn.nodes)
      .filter(
        (diagramNode) =>
          surfaceNodeIds.includes(diagramNode.id) ||
          diagramNode.id.endsWith('-states') ||
          diagramNode.id.endsWith('-remediation') ||
          diagramNode.label === 'Native gate',
      )
      .map((diagramNode) => diagramNode.id);

    for (const nodeId of requiredNodeIds) {
      assert.ok(
        connectedNodeIds.has(nodeId),
        `${spec.key}: ${nodeId} must participate in a transition`,
      );
    }

    assert.ok(
      spec.edges.some(
        (diagramEdge) =>
          diagramEdge.from === `${spec.key.replace('-ui', '')}-api` &&
          diagramEdge.to === `${spec.key.replace('-ui', '')}-states`,
      ),
      `${spec.key}: authoritative result must expose UI states`,
    );
    assert.ok(
      spec.edges.some(
        (diagramEdge) =>
          diagramEdge.from === `${spec.key.replace('-ui', '')}-states` &&
          diagramEdge.to === `${spec.key.replace('-ui', '')}-remediation`,
      ),
      `${spec.key}: failed or denied states must lead to remediation`,
    );
  }
});

test('should separate public Buyer or Viewer entry from authenticated creator tools', () => {
  const expectations = {
    '3-03-ui': {
      publicEntry: '3-03-public-entry',
      publicScreens: ['mh-015'],
      authenticatedEntry: '3-03-auth-entry',
      authenticatedScreens: ['mh-012', 'mh-016'],
    },
    '3-05-ui': {
      publicEntry: '3-05-public-entry',
      publicScreens: ['mh-022'],
      authenticatedEntry: '3-05-auth-entry',
      authenticatedScreens: ['mh-023'],
    },
    '3-06-ui': {
      publicEntry: '3-06-public-entry',
      publicScreens: ['mh-027', 'mh-030'],
      authenticatedEntry: '3-06-auth-entry',
      authenticatedScreens: ['mh-028'],
    },
  } as const;

  for (const [key, expectation] of Object.entries(expectations)) {
    const spec = UI_SPECS.find((item) => item.key === key);
    assert.ok(spec, `${key}: missing spec`);
    const nodes = spec.columns.flatMap((diagramColumn) => diagramColumn.nodes);
    const publicEntry = nodes.find(
      (diagramNode) => diagramNode.id === expectation.publicEntry,
    );
    const authenticatedEntry = nodes.find(
      (diagramNode) => diagramNode.id === expectation.authenticatedEntry,
    );
    assert.match(
      `${publicEntry?.label} ${publicEntry?.detail}`,
      /public.*(?:buyer|viewer)|(?:buyer|viewer).*public/i,
      `${key}: public Buyer/Viewer entry`,
    );
    assert.match(
      `${authenticatedEntry?.label} ${authenticatedEntry?.detail}`,
      /authenticated/i,
      `${key}: authenticated creator entry`,
    );

    for (const screenId of expectation.publicScreens) {
      assert.ok(
        spec.edges.some(
          (diagramEdge) =>
            diagramEdge.from === expectation.publicEntry &&
            diagramEdge.to === screenId,
        ),
        `${key}: public entry -> ${screenId}`,
      );
      const screen = nodes.find((diagramNode) => diagramNode.id === screenId);
      assert.equal(screen?.tone, 'system', `${key}: ${screenId} public tone`);
      assert.match(
        `${screen?.label} ${screen?.detail}`,
        /public|buyer|viewer/i,
        `${key}: ${screenId} public audience`,
      );
    }

    for (const screenId of expectation.authenticatedScreens) {
      assert.ok(
        spec.edges.some(
          (diagramEdge) =>
            diagramEdge.from === expectation.authenticatedEntry &&
            diagramEdge.to === screenId,
        ),
        `${key}: authenticated entry -> ${screenId}`,
      );
    }
  }

  for (const [key, nodeIds] of Object.entries({
    '3-05-ui': ['mh-022', 'mh-025'],
    '3-06-ui': ['mh-027', 'mh-030'],
  })) {
    const spec = UI_SPECS.find((item) => item.key === key);
    assert.ok(spec, `${key}: missing spec`);
    const nodes = spec.columns.flatMap((diagramColumn) => diagramColumn.nodes);
    for (const nodeId of nodeIds) {
      const screen = nodes.find((diagramNode) => diagramNode.id === nodeId);
      assert.equal(screen?.tone, 'system', `${key}: ${nodeId} Viewer tone`);
      assert.match(
        `${screen?.label} ${screen?.detail}`,
        /buyer|viewer/i,
        `${key}: ${nodeId} Buyer/Viewer copy`,
      );
    }
  }
});

test('should expose seller catalog and admin moderation boundaries for Video and LIVE', () => {
  for (const key of ['3-05-ui', '3-06-ui']) {
    const spec = UI_SPECS.find((item) => item.key === key);
    assert.ok(spec, `${key}: missing spec`);
    const surfaceColumn = spec.columns.find((diagramColumn) =>
      /surface boundary/i.test(diagramColumn.title),
    );
    assert.ok(surfaceColumn, `${key}: missing surface boundary`);
    const labels = surfaceColumn.nodes.map((diagramNode) => diagramNode.label);
    assert.ok(labels.includes('Vendor Portal'), `${key}: Vendor Portal`);
    assert.ok(labels.includes('Medusa Admin'), `${key}: Medusa Admin`);
  }

  const video = UI_SPECS.find((item) => item.key === '3-05-ui');
  const live = UI_SPECS.find((item) => item.key === '3-06-ui');
  assert.ok(video);
  assert.ok(live);
  assert.ok(
    video.edges.some(
      (diagramEdge) =>
        diagramEdge.from === '3-05-vendor' && diagramEdge.to === 'mh-024',
    ),
    '3-05-ui: seller catalog -> product picker',
  );
  assert.ok(
    video.edges.some(
      (diagramEdge) =>
        diagramEdge.from === '3-05-admin' && diagramEdge.to === 'mh-026',
    ),
    '3-05-ui: admin moderation -> appeal',
  );
  assert.ok(
    live.edges.some(
      (diagramEdge) =>
        diagramEdge.from === '3-06-vendor' && diagramEdge.to === 'mh-028',
    ),
    '3-06-ui: seller catalog -> host product tray setup',
  );
  assert.ok(
    live.edges.some(
      (diagramEdge) =>
        diagramEdge.from === '3-06-admin' && diagramEdge.to === 'mh-031',
    ),
    '3-06-ui: admin moderation -> replay evidence',
  );
});

test('should keep MCN tools in the storefront application unless an ADR changes the boundary', () => {
  const spec = UI_SPECS.find((item) => item.key === '3-09-ui');
  assert.ok(spec);
  const surfaceText = spec.columns
    .find((diagramColumn) => /surface boundary/i.test(diagramColumn.title))
    ?.nodes.map((diagramNode) => `${diagramNode.label} ${diagramNode.detail}`)
    .join(' ');
  assert.ok(surfaceText);
  assert.doesNotMatch(surfaceText, /Vendor Portal/i);
  assert.match(surfaceText, /Storefront/i);
  assert.match(surfaceText, /apps\/storefront\/src\/app\/mcn\/\*/i);
  assert.match(surfaceText, /ADR/i);
});

test('should require ADR, implementation, and authenticated native evidence before parity closure', () => {
  for (const key of ['3-05-ui', '3-06-ui']) {
    const spec = UI_SPECS.find((item) => item.key === key);
    assert.ok(spec, `${key}: missing spec`);
    const nativeGate = spec.columns
      .flatMap((diagramColumn) => diagramColumn.nodes)
      .find((diagramNode) => diagramNode.label === 'Native gate');
    assert.ok(nativeGate, `${key}: Native gate`);
    assert.match(nativeGate.detail, /ADR/i, `${key}: ADR evidence`);
    assert.match(
      nativeGate.detail,
      /implementation/i,
      `${key}: implementation evidence`,
    );
    assert.match(
      nativeGate.detail,
      /authenticated/i,
      `${key}: authenticated evidence`,
    );
    assert.ok(
      spec.edges.some(
        (diagramEdge) =>
          diagramEdge.from === nativeGate.id ||
          diagramEdge.to === nativeGate.id,
      ),
      `${key}: connected Native gate`,
    );
  }
});

test('should treat reversed as a compensating entry while preserving all six money terms', () => {
  const spec = UI_SPECS.find((item) => item.key === '3-10-ui');
  assert.ok(spec);
  const wallet = spec.columns
    .flatMap((diagramColumn) => diagramColumn.nodes)
    .find((diagramNode) => diagramNode.id === 'mh-046');
  assert.ok(wallet);
  for (const moneyTerm of [
    'estimated',
    'approved',
    'payable',
    'paid',
    'held',
    'reversed',
  ]) {
    assert.match(wallet.detail, new RegExp(moneyTerm, 'i'));
  }
  assert.match(wallet.detail, /reversed.*compensating entry/i);
  assert.match(wallet.detail, /not (?:a )?balance state|never (?:a )?balance/i);
  assert.doesNotMatch(wallet.detail, /reversed balances?/i);
});
