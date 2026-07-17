import assert from 'node:assert/strict';
import test from 'node:test';

import { BACKEND_SPECS } from './backend-specs.ts';
import { auditVietnameseCopy } from './localization-policy.ts';
import { DIAGRAM_TARGETS } from './manifest.ts';
import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import type { TDiagramSpec } from './types.ts';
import { UI_SPECS } from './ui-specs.ts';

const ALL_SPECS = [
  ...OVERVIEW_AND_TEST_SPECS,
  ...BACKEND_SPECS,
  ...UI_SPECS,
] as const satisfies readonly TDiagramSpec[];

const APPROVED_BADGES = new Set([
  'Hiện có',
  'Mở rộng',
  'Mới',
  'Cổng xác thực thực địa',
]);

const VIETNAMESE_SPEC: TDiagramSpec = {
  key: 'localization-policy-fixture',
  title: 'Luồng kiểm thử bản địa hóa',
  subtitle: 'CN-001–CN-002',
  scope: 'Phạm vi kiểm tra nội dung hiển thị.',
  columns: [
    {
      title: 'Điểm bắt đầu',
      nodes: [
        {
          id: 'creator',
          label: 'Creator',
          detail: 'Người dùng bắt đầu luồng kiểm thử.',
          tone: 'creator',
          badge: 'Hiện có',
        },
      ],
    },
    {
      title: 'Điểm kết thúc',
      nodes: [
        {
          id: 'evidence',
          label: 'Bằng chứng',
          detail: 'Hệ thống lưu bằng chứng kiểm tra.',
          tone: 'system',
          badge: 'Cổng xác thực thực địa',
        },
      ],
    },
  ],
  edges: [
    {
      from: 'creator',
      to: 'evidence',
      label: 'ghi nhận bằng chứng',
      style: 'dotted',
    },
  ],
};

test('should pass the Vietnamese visible-copy policy for all targets and specs', () => {
  assert.deepEqual(auditVietnameseCopy(DIAGRAM_TARGETS, ALL_SPECS), []);
  for (const spec of ALL_SPECS) {
    for (const node of spec.columns.flatMap((column) => column.nodes)) {
      if (node.badge) {
        assert.ok(APPROVED_BADGES.has(node.badge));
      }
    }
  }
});

test('should accept Vietnamese spec copy and approved technical-only values', () => {
  assert.deepEqual(auditVietnameseCopy([], [VIETNAMESE_SPEC]), []);
});

test('should report English explanatory copy and forbidden legacy footer phrases', () => {
  const englishSpec: TDiagramSpec = {
    ...VIETNAMESE_SPEC,
    title: 'English explanatory title',
    scope: 'Visual aid with normative text.',
  };

  const errors = auditVietnameseCopy([], [englishSpec]);

  assert.ok(errors.some((error) => error.includes('missing Vietnamese')));
  assert.ok(errors.some((error) => error.includes('/Visual aid/i')));
  assert.ok(errors.some((error) => error.includes('/normative text/i')));
});
