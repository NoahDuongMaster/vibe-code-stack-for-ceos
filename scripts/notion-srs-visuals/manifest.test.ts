import assert from 'node:assert/strict';
import test from 'node:test';

import { DIAGRAM_TARGETS } from './manifest.ts';

const EXPECTED_TITLES = new Map([
  ['page-1-system-context', 'Bối cảnh hệ thống & bản đồ tác nhân'],
  ['page-1-end-to-end', 'Luồng dữ liệu, tiền & bằng chứng đầu cuối'],
  ['2-01-backend', 'Vòng đời định danh, onboarding & tài khoản'],
  ['2-02-backend', 'Dashboard, ưu đãi, hoa hồng & giới thiệu'],
  ['2-03-backend', 'Link, mã sản phẩm, bộ sưu tập & báo cáo'],
  ['2-04-backend', 'Attribution, snapshot tỷ lệ & sổ cái hoa hồng'],
  ['2-05-backend', 'Vòng đời thương mại Video ngắn'],
  ['2-06-backend', 'Vòng đời LIVE Commerce'],
  ['2-07-backend', 'PPS người bán, tỷ lệ & liên hệ Creator'],
  ['2-08-backend', 'PPP, cộng tác, hàng mẫu & Seller Affiliate'],
  ['2-09-backend', 'MCN roster, RBAC & phân chia doanh thu'],
  ['2-10-backend', 'Đối soát, payout, thuế & khắc phục'],
  ['2-11-backend', 'Gian lận, enforcement & khiếu nại'],
  ['2-12-backend', 'Phân phối ngoài nền tảng & YouTube Shopping'],
  ['3-01-ui', 'Điều hướng UI định danh & onboarding'],
  ['3-02-ui', 'Điều hướng UI dashboard, ưu đãi & giới thiệu'],
  ['3-03-ui', 'Điều hướng UI link, bộ sưu tập & báo cáo'],
  ['3-04-ui', 'Điều hướng UI attribution & ledger'],
  ['3-05-ui', 'Điều hướng UI thương mại Video ngắn'],
  ['3-06-ui', 'Điều hướng UI LIVE Commerce'],
  ['3-07-ui', 'Điều hướng UI Seller PPS & liên hệ Creator'],
  ['3-08-ui', 'Điều hướng UI cộng tác PPP'],
  ['3-09-ui', 'Điều hướng UI MCN & agency'],
  ['3-10-ui', 'Điều hướng UI payout, thuế & đối soát'],
  ['3-11-ui', 'Điều hướng UI gian lận, enforcement & khiếu nại'],
  ['3-12-ui', 'Điều hướng UI phân phối ngoài nền tảng'],
  ['page-4-traceability', 'Chuỗi truy vết yêu cầu'],
  ['page-4-release-gate', 'Cổng kiểm thử, bằng chứng & phát hành'],
]);

const EXPECTED_MIXED_CODE_RANGES = new Map([
  [
    'page-1-system-context',
    'SRS-BENA-AFF-US-001 — tác nhân và ranh giới tin cậy',
  ],
  ['page-1-end-to-end', 'SP-001–SP-084 — tổng quan'],
  ['page-4-traceability', 'SP → CN → QT → MH/non-UI → KT → bằng chứng'],
  ['page-4-release-gate', 'KT-001–KT-120 và bằng chứng phát hành'],
]);

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
  assert.ok(DIAGRAM_TARGETS.every((item) => item.currentVersion === '0.5'));
});

test('should use exact headings as non-destructive insertion anchors', () => {
  assert.ok(
    DIAGRAM_TARGETS.every((item) => item.insertBefore.startsWith('##')),
  );
  assert.ok(DIAGRAM_TARGETS.every((item) => item.alt.length >= 40));
  assert.ok(
    DIAGRAM_TARGETS.every((item) =>
      item.caption.endsWith(
        'Hình minh họa; nội dung SRS chuẩn tắc vẫn là nguồn quyết định.',
      ),
    ),
  );
});

test('should expose exact Vietnamese target titles and mixed code-range suffixes', () => {
  assert.equal(EXPECTED_TITLES.size, 28);
  for (const target of DIAGRAM_TARGETS) {
    assert.equal(target.title, EXPECTED_TITLES.get(target.key), target.key);
    assert.match(target.alt, /[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/i);
    assert.match(target.alt, /\.$/);
  }

  for (const [key, codeRange] of EXPECTED_MIXED_CODE_RANGES) {
    const target = DIAGRAM_TARGETS.find((item) => item.key === key);
    assert.ok(target);
    assert.equal(target.codeRange, codeRange);
  }
});

test('should retain exact non-empty legacy copy for one-for-one replacement', () => {
  for (const target of DIAGRAM_TARGETS) {
    assert.ok(target.legacy.title.length > 0, `${target.key}: legacy title`);
    assert.ok(target.legacy.alt.length > 0, `${target.key}: legacy alt`);
    assert.ok(
      target.legacy.caption.length > 0,
      `${target.key}: legacy caption`,
    );
    assert.match(target.legacy.caption, /normative text remains authoritative/);
    assert.notEqual(target.title, target.legacy.title, target.key);
    assert.notEqual(target.alt, target.legacy.alt, target.key);
  }
});
