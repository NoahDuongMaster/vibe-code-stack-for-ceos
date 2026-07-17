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
    'bản nháp đăng ký',
    'đã gửi',
    'định danh',
    'quyền sở hữu kênh',
    'admin xét duyệt',
    'active',
    'needs_action',
    'rejected',
    'tạm ngưng',
    'xác minh lại',
    'bằng chứng có phiên bản',
  ],
  '2-02-backend': [
    'truy vấn dashboard',
    'ưu đãi',
    'phiên bản tỷ lệ',
    'đủ điều kiện',
    'lời mời',
    'tham gia',
    'tài sản link/nội dung/giới thiệu',
    'lượt nhấp/đơn hàng/thu nhập',
    'độ mới',
    'audit',
  ],
  '2-03-backend': [
    'link',
    'mã',
    'bộ sưu tập',
    'bộ phân giải',
    'chuyển hướng',
    'bằng chứng lượt nhấp',
    'chuyển đổi theo dòng đơn hàng',
    'báo cáo',
    'thu nhập',
    'thanh toán',
    'xuất dữ liệu',
  ],
  '2-04-backend': [
    'điểm chạm',
    'cửa sổ',
    'tập ứng viên',
    'lớp attribution',
    'kết quả thắng',
    'snapshot tỷ lệ',
    'sổ cái',
    'điều chỉnh',
    'phát lại bằng chứng',
  ],
  '2-05-backend': [
    'tải lên',
    'transcode',
    'bản nháp',
    'tags',
    'voucher',
    'phiên bản bất biến',
    'feed',
    'chi tiết',
    'lượt nhấp/đơn hàng thương mại',
    'kiểm duyệt',
    'khiếu nại',
    'bằng chứng',
  ],
  '2-06-backend': [
    'lên lịch',
    'preflight',
    'ingest',
    'metadata',
    'phiên live',
    'ghim sản phẩm',
    'khay sản phẩm',
    'chat',
    'q&a',
    'chuyển đổi khám phá',
    'replay',
    'bằng chứng kiểm duyệt',
  ],
  '2-07-backend': [
    'điều kiện pps',
    'điều khoản',
    'tham gia',
    'phiên bản sản phẩm/tỷ lệ',
    'khám phá creator',
    'chat',
    'đồng ý liên hệ',
    'thu hồi',
    'hết hạn',
    'audit',
  ],
  '2-08-backend': [
    'cuộc hội thoại',
    'đề xuất',
    'hợp đồng',
    'phí đã cấp vốn',
    'vận chuyển hàng mẫu',
    'sản phẩm bàn giao',
    'xét duyệt',
    'giải ngân',
    'hủy',
    'tranh chấp',
    'bằng chứng',
  ],
  '2-09-backend': [
    'đơn đăng ký mcn',
    'lời mời roster',
    'tư cách thành viên',
    'rbac',
    'phân công',
    'báo cáo',
    'phân chia',
    'quyết toán',
    'thông báo',
    'audit',
  ],
  '2-10-backend': [
    'cổng định danh/thuế/thanh toán',
    'wallet',
    'kỳ mở',
    'sao kê',
    'payout qua nhà cung cấp',
    'đối soát',
    'thông báo',
    'giữ lại',
    'thử lại',
    'điều chỉnh',
    'bằng chứng bù trừ',
  ],
  '2-11-backend': [
    'báo cáo',
    'bằng chứng',
    'phân loại rủi ro',
    'đồ thị thực thể',
    'chính sách quyết định',
    'giữ lại',
    'đảo ngược',
    'thực thi',
    'khiếu nại',
    'thu hồi',
    'gỡ bỏ',
    'bằng chứng được bảo toàn',
  ],
  '2-12-backend': [
    'đăng ký property',
    'xác minh',
    'hỗ trợ disclosure',
    'oauth',
    'phạm vi quyền',
    'catalog',
    'đồng bộ feed',
    'tag ngoài nền tảng',
    'báo cáo lượt nhấp/đơn hàng/thu nhập',
    'ngắt kết nối',
    'sức khỏe',
    'audit',
  ],
};

const APPROVED_BADGES = new Set([
  'Hiện có',
  'Mở rộng',
  'Mới',
  'Cổng xác thực thực địa',
]);

const VIETNAMESE_SIGNAL =
  /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

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

const backendSpec = (key: string): (typeof BACKEND_SPECS)[number] => {
  const spec = BACKEND_SPECS.find((item) => item.key === key);
  assert.ok(spec, `${key} must exist`);
  return spec;
};

const backendNode = (key: string, nodeId: string) => {
  const found = backendSpec(key)
    .columns.flatMap((column) => column.nodes)
    .find((node) => node.id === nodeId);
  assert.ok(found, `${key} must contain ${nodeId}`);
  return found;
};

const isReachable = (
  spec: (typeof BACKEND_SPECS)[number],
  from: string,
  to: string,
): boolean => {
  const adjacency = new Map<string, string[]>();
  for (const edge of spec.edges) {
    const destinations = adjacency.get(edge.from) ?? [];
    destinations.push(edge.to);
    adjacency.set(edge.from, destinations);
  }

  const pending = [from];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    if (current === to) {
      return true;
    }
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }

  return false;
};

const assertOrderedReachability = (
  key: string,
  orderedNodeIds: readonly string[],
): void => {
  const spec = backendSpec(key);
  for (const nodeId of orderedNodeIds) {
    backendNode(key, nodeId);
  }
  for (let index = 1; index < orderedNodeIds.length; index += 1) {
    const from = orderedNodeIds[index - 1];
    const to = orderedNodeIds[index];
    assert.ok(
      from && to && isReachable(spec, from, to),
      `${key} must reach ${to} after ${from}`,
    );
  }
};

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
            /an toàn|khiếu nại|thử lại|xác minh lại|thu hồi|ngắt kết nối|tranh chấp|điều chỉnh/i.test(
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
      badges.has('Mới'),
      `${spec.key} must identify new affiliate work`,
    );
    assert.ok(
      badges.has('Hiện có') || badges.has('Mở rộng'),
      `${spec.key} must identify reused or extended source primitives`,
    );
    for (const badge of badges) {
      assert.ok(
        APPROVED_BADGES.has(badge),
        `${spec.key} contains unapproved badge ${badge}`,
      );
    }
  }

  for (const key of ['2-04-backend', '2-11-backend']) {
    const spec = BACKEND_SPECS.find((item) => item.key === key);
    assert.ok(spec);
    assert.ok(
      spec.columns
        .flatMap((column) => column.nodes)
        .some((node) => node.badge === 'Cổng xác thực thực địa'),
      `${key} must gate unobservable attribution/risk internals`,
    );
  }
});

test('should use Vietnamese visible copy in every backend diagram', () => {
  for (const spec of BACKEND_SPECS) {
    const visibleCopy = [
      spec.title,
      spec.scope,
      ...spec.columns.flatMap((column) => [
        column.title,
        ...column.nodes.flatMap((node) => [node.label, node.detail]),
      ]),
      ...spec.edges.map((edge) => edge.label),
    ];
    for (const value of visibleCopy) {
      assert.match(
        value,
        VIETNAMESE_SIGNAL,
        `${spec.key} must translate visible copy: ${value}`,
      );
    }
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

test('should route every tracked asset through click, conversion, reporting, and earnings', () => {
  for (const assetId of ['link', 'code', 'collection']) {
    assertOrderedReachability('2-03-backend', [
      assetId,
      'resolver',
      'click-proof',
      'conversion',
      'reports',
      'earnings',
      'report-evidence',
    ]);
  }
});

test('should resolve attribution in deterministic candidate order without secret-ranking claims', () => {
  assertOrderedReachability('2-04-backend', [
    'touchpoints',
    'candidates',
    'class',
    'winner',
    'rate',
    'ledger',
    'attribution-evidence',
  ]);
  assert.doesNotMatch(
    semanticText(backendSpec('2-04-backend')),
    /rank|secret|xếp hạng|bí mật/i,
  );
});

test('should connect both pre-publish and post-publish video moderation paths', () => {
  assertOrderedReachability('2-05-backend', [
    'video-draft',
    'video-moderation',
    'video-tags',
    'video-publish',
    'video-feed',
    'video-commerce',
  ]);
  assertOrderedReachability('2-05-backend', [
    'video-publish',
    'video-moderation',
    '2-05-backend-remediation',
    'video-evidence',
  ]);
});

test('should open a live session before commerce and turn an ended session into replay evidence', () => {
  assertOrderedReachability('2-06-backend', [
    'live-prepare',
    'live-metadata',
    'live-session',
    'live-products',
    'live-chat',
    'live-conversion',
  ]);
  assertOrderedReachability('2-06-backend', [
    'live-session',
    'live-recording',
    'live-evidence',
  ]);
});

test('should authorize an MCN assignment before its report, split, and settlement', () => {
  assertOrderedReachability('2-09-backend', [
    'mcn-application',
    'membership',
    'mcn-rbac',
    'mcn-assignment',
    'mcn-revenue',
    'mcn-settlement',
  ]);
});

test('should accrue earnings into an open period before payee gating and held/payable branches', () => {
  assertOrderedReachability('2-10-backend', [
    'approved-earning',
    'wallet-period',
    'reconciliation',
    'payment-gates',
    'held-payout',
    '2-10-backend-remediation',
    'payout-evidence',
  ]);
  assertOrderedReachability('2-10-backend', [
    'approved-earning',
    'wallet-period',
    'reconciliation',
    'payment-gates',
    'payable-payout',
    'statement',
    'provider-payout',
    'payout-evidence',
  ]);
});

test('should describe source-fit truthfully for sample and YouTube feed/tag domains', () => {
  const sample = backendNode('2-08-backend', 'sample');
  assert.match(sample.label, /\bSample\b/);
  assert.equal(sample.badge, 'Mới');
  assert.equal(backendNode('2-12-backend', 'catalog-sync').badge, 'Mới');
});

test('should keep CN-004 parity open until native ADR, implementation, and authenticated evidence exist', () => {
  const nativeGate = backendNode('2-01-backend', 'native-parity-gate');
  assert.equal(nativeGate.badge, 'Cổng xác thực thực địa');
  assert.match(nativeGate.detail, /ADR/i);
  assert.match(nativeGate.detail, /triển khai native/i);
  assert.match(nativeGate.detail, /bằng chứng xác thực/i);
  assertOrderedReachability('2-01-backend', ['native-parity-gate', 'evidence']);
});

test('should render all twelve backend diagrams', () => {
  for (const spec of BACKEND_SPECS) {
    assert.doesNotThrow(() => renderDiagram(spec), `${spec.key} must render`);
  }
});
