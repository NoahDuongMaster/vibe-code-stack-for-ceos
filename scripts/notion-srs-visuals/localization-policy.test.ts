import assert from 'node:assert/strict';
import test from 'node:test';

import { auditVietnameseCopy } from './localization-policy.ts';
import { DIAGRAM_TARGETS } from './manifest.ts';

import type { TDiagramSpec } from './types.ts';

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

test('should pass the Vietnamese visible-copy policy for all replacement targets', () => {
  assert.deepEqual(auditVietnameseCopy(DIAGRAM_TARGETS, []), []);
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
