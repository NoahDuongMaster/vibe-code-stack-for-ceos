import assert from 'node:assert/strict';
import test from 'node:test';

import { BACKEND_SPECS } from './backend-specs.ts';
import { TARGET_BY_KEY } from './manifest.ts';
import { renderDiagram } from './svg-renderer.ts';

const EXPECTED_KEYS = Array.from(
  { length: 12 },
  (_, index) => `2-${String(index + 1).padStart(2, '0')}-backend`,
);

const LIFECYCLE_TERMS: Readonly<Record<string, readonly string[]>> = {
  '2-01-backend': [
    'application draft',
    'submitted',
    'identity',
    'channel ownership',
    'admin review',
    'active',
    'needs_action',
    'rejected',
    'suspension',
    'reverification',
    'versioned evidence',
  ],
  '2-02-backend': [
    'dashboard query',
    'offer',
    'rate version',
    'eligibility',
    'invitation',
    'enrollment',
    'link/content/referral asset',
    'click/order/earning',
    'freshness',
    'audit',
  ],
  '2-03-backend': [
    'link',
    'code',
    'collection',
    'resolver',
    'redirect',
    'click evidence',
    'order-line conversion',
    'reports',
    'earnings',
    'payment',
    'export',
  ],
  '2-04-backend': [
    'touchpoints',
    'window',
    'candidate set',
    'class',
    'winner',
    'rate snapshot',
    'ledger',
    'adjustment',
    'evidence replay',
  ],
  '2-05-backend': [
    'upload',
    'transcode',
    'draft',
    'tags',
    'voucher',
    'immutable version',
    'feed',
    'detail',
    'commerce click/order',
    'moderation',
    'appeal',
    'evidence',
  ],
  '2-06-backend': [
    'schedule',
    'preflight',
    'ingest',
    'metadata',
    'live session',
    'product pin',
    'tray',
    'chat',
    'q&a',
    'discovery conversion',
    'replay',
    'moderation evidence',
  ],
  '2-07-backend': [
    'pps eligibility',
    'terms',
    'enrollment',
    'product/rate version',
    'creator discovery',
    'chat',
    'contact consent',
    'revoke',
    'expiry',
    'audit',
  ],
  '2-08-backend': [
    'conversation',
    'proposal',
    'contract',
    'funded fee',
    'sample shipment',
    'deliverable',
    'review',
    'release',
    'cancellation',
    'dispute',
    'evidence',
  ],
  '2-09-backend': [
    'mcn application',
    'roster invitation',
    'membership',
    'rbac',
    'assignment',
    'report',
    'split',
    'settlement',
    'notification',
    'audit',
  ],
  '2-10-backend': [
    'identity/tax/payment gates',
    'wallet',
    'period',
    'statement',
    'provider payout',
    'reconciliation',
    'notify',
    'hold',
    'retry',
    'correct',
    'compensating evidence',
  ],
  '2-11-backend': [
    'report',
    'evidence',
    'risk triage',
    'entity graph',
    'decision policy',
    'hold',
    'reverse',
    'enforce',
    'appeal',
    'recall',
    'takedown',
    'preserved evidence',
  ],
  '2-12-backend': [
    'property registration',
    'verification',
    'disclosure helper',
    'oauth',
    'scopes',
    'catalog',
    'feed sync',
    'external tag',
    'click/order/earning report',
    'disconnect',
    'health',
    'audit',
  ],
};

const semanticText = (spec: (typeof BACKEND_SPECS)[number]): string =>
  [
    spec.title,
    spec.subtitle,
    spec.scope,
    ...spec.columns.flatMap((column) => [
      column.title,
      ...column.nodes.flatMap((node) => [node.label, node.detail]),
    ]),
    ...spec.edges.map((edge) => edge.label),
  ]
    .join(' ')
    .toLowerCase();

test('should define exactly the twelve approved backend keys', () => {
  const keys = BACKEND_SPECS.map((spec) => spec.key);

  assert.deepEqual(keys, EXPECTED_KEYS);
  assert.equal(new Set(keys).size, 12);
});

test('should stay inside each manifest CN range and renderer layout limits', () => {
  for (const spec of BACKEND_SPECS) {
    const target = TARGET_BY_KEY.get(spec.key);
    assert.ok(target, `${spec.key} must exist in the manifest`);
    assert.equal(spec.subtitle, target.codeRange);
    assert.ok(
      spec.columns.length >= 2 && spec.columns.length <= 5,
      `${spec.key} must have 2–5 columns`,
    );
    assert.ok(
      spec.columns.every(
        (column) => column.nodes.length >= 1 && column.nodes.length <= 4,
      ),
      `${spec.key} columns must contain 1–4 nodes`,
    );

    const range = target.codeRange.match(/^CN-(\d{3})–CN-(\d{3})$/);
    assert.ok(range, `${spec.key} must have a parseable CN range`);
    const minimum = Number(range[1]);
    const maximum = Number(range[2]);
    const mentionedCodes = semanticText(spec).match(/cn-(\d{3})/g) ?? [];

    for (const code of mentionedCodes) {
      const value = Number(code.slice(3));
      assert.ok(
        value >= minimum && value <= maximum,
        `${spec.key} contains out-of-range ${code.toUpperCase()}`,
      );
    }
  }
});

test('should connect evidence and expose a safe remediation path', () => {
  for (const spec of BACKEND_SPECS) {
    const nodeIds = new Set(
      spec.columns.flatMap((column) => column.nodes.map((node) => node.id)),
    );
    assert.ok(
      spec.edges.some((edge) => edge.style === 'dotted'),
      `${spec.key} needs a dotted evidence edge`,
    );
    assert.ok(
      spec.columns
        .flatMap((column) => column.nodes)
        .some(
          (node) =>
            node.id.endsWith('-remediation') &&
            /safe|appeal|retry|reverif|revoke|disconnect|dispute|correct/i.test(
              `${node.label} ${node.detail}`,
            ),
        ),
      `${spec.key} needs an explicit safe failure/remediation node`,
    );

    for (const edge of spec.edges) {
      assert.ok(nodeIds.has(edge.from), `${spec.key} missing ${edge.from}`);
      assert.ok(nodeIds.has(edge.to), `${spec.key} missing ${edge.to}`);
    }
  }
});

test('should make source fit visible without claiming secret parity', () => {
  for (const spec of BACKEND_SPECS) {
    const badges = new Set(
      spec.columns.flatMap((column) =>
        column.nodes.flatMap((node) => (node.badge ? [node.badge] : [])),
      ),
    );
    assert.ok(
      badges.has('New'),
      `${spec.key} must identify new affiliate work`,
    );
    assert.ok(
      badges.has('Existing') || badges.has('Extend'),
      `${spec.key} must identify reused or extended source primitives`,
    );
  }

  for (const key of ['2-04-backend', '2-11-backend']) {
    const spec = BACKEND_SPECS.find((item) => item.key === key);
    assert.ok(spec);
    assert.ok(
      spec.columns
        .flatMap((column) => column.nodes)
        .some((node) => node.badge === 'Field-validation gate'),
      `${key} must gate unobservable attribution/risk internals`,
    );
  }
});

test('should include every approved lifecycle stage', () => {
  for (const spec of BACKEND_SPECS) {
    const text = semanticText(spec);
    const requiredTerms = LIFECYCLE_TERMS[spec.key];
    assert.ok(requiredTerms, `${spec.key} needs a lifecycle contract`);

    for (const term of requiredTerms) {
      assert.ok(text.includes(term), `${spec.key} must include ${term}`);
    }
  }
});

test('should render all twelve backend diagrams', () => {
  for (const spec of BACKEND_SPECS) {
    assert.doesNotThrow(() => renderDiagram(spec), `${spec.key} must render`);
  }
});
