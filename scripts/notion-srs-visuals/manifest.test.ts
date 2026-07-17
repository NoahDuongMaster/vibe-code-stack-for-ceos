import assert from 'node:assert/strict';
import test from 'node:test';

import { DIAGRAM_TARGETS } from './manifest.ts';

test('should define the approved 28 unique SVG targets', () => {
  assert.equal(DIAGRAM_TARGETS.length, 28);
  assert.equal(new Set(DIAGRAM_TARGETS.map((item) => item.key)).size, 28);
  assert.equal(new Set(DIAGRAM_TARGETS.map((item) => item.filename)).size, 28);
  assert.ok(DIAGRAM_TARGETS.every((item) => item.filename.endsWith('.svg')));
});

test('should place two overview, twelve backend, twelve UI, and two test diagrams', () => {
  const count = (kind: string): number =>
    DIAGRAM_TARGETS.filter((item) => item.kind === kind).length;

  assert.equal(count('overview'), 2);
  assert.equal(count('backend'), 12);
  assert.equal(count('ui'), 12);
  assert.equal(count('test'), 2);
});

test('should preserve the observed page-level version baseline', () => {
  assert.equal(
    DIAGRAM_TARGETS.filter((item) => item.previousVersion === '0.2').length,
    16,
  );
  assert.equal(
    DIAGRAM_TARGETS.filter((item) => item.previousVersion === '0.4').length,
    12,
  );
  assert.ok(DIAGRAM_TARGETS.every((item) => item.nextVersion === '0.5'));
});

test('should use exact headings as non-destructive insertion anchors', () => {
  assert.ok(
    DIAGRAM_TARGETS.every((item) => item.insertBefore.startsWith('##')),
  );
  assert.ok(DIAGRAM_TARGETS.every((item) => item.alt.length >= 40));
  assert.ok(
    DIAGRAM_TARGETS.every((item) => item.caption.includes('normative text')),
  );
});
