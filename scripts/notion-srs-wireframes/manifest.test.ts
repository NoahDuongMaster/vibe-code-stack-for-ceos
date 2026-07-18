import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MOCKUP_SCREEN_CODES,
  MOCKUP_TARGETS,
  UI_WIREFRAME_PAGES,
  WIREFRAME_TARGETS,
} from './manifest.ts';

const EXPECTED_PAGE_KEYS = [
  '3-01-ui',
  '3-02-ui',
  '3-03-ui',
  '3-04-ui',
  '3-05-ui',
  '3-06-ui',
  '3-07-ui',
  '3-08-ui',
  '3-09-ui',
  '3-10-ui',
  '3-11-ui',
  '3-12-ui',
] as const;

const EXPECTED_PAGE_IDS = [
  '502ad27c8378822baeff81acdf027872',
  '3a0ad27c8378818d87b6c9e72728a9d2',
  '3a0ad27c8378817fada9f89511ba99e1',
  '3a0ad27c837881699337d970fd99a9c4',
  '3a0ad27c83788162bc0bebeb19eb3654',
  '3a0ad27c83788147a823e5f65aae74c8',
  '3a0ad27c83788149a696d53cfc062b11',
  '3a0ad27c8378819e8100d2b502000d4e',
  '3a0ad27c837881549d4af92e27878a6c',
  '3a0ad27c83788173ae60c1f3ddda9fe0',
  '3a0ad27c837881998be8c368ba4437b9',
  '3a0ad27c837881b1b359f8df360d1bef',
] as const;

const EXPECTED_PAGE_IMAGE_TOTALS = [7, 8, 8, 6, 7, 7, 6, 7, 7, 7, 7, 6];

const EXPECTED_INSERT_BEFORE = '### Quy ước Component Contract';

const EXPECTED_RELATED_PAGE_URLS = [
  'https://app.notion.com/p/a0fad27c837882bd8a5781a0ce5ef4a6',
  'https://app.notion.com/p/3a0ad27c83788175ad48e3637264a0c6',
  'https://app.notion.com/p/3a0ad27c8378815a9ebee9c2cfca01c7',
  'https://app.notion.com/p/3a0ad27c837881859fcad6114eed59a0',
  'https://app.notion.com/p/3a0ad27c837881c1b06ddf6cee307cb4',
  'https://app.notion.com/p/3a0ad27c837881e09720ee71d2a4239a',
  'https://app.notion.com/p/3a0ad27c837881568f2ed253143d14b1',
  'https://app.notion.com/p/3a0ad27c8378817b8d1ac107731cc836',
  'https://app.notion.com/p/3a0ad27c83788133902fe4ce1910435e',
  'https://app.notion.com/p/3a0ad27c8378814d9d0fe3849c42f3fc',
  'https://app.notion.com/p/3a0ad27c837881348366cc8572374d38',
  'https://app.notion.com/p/3a0ad27c837881b4beb5e186e857672b',
] as const;

const EXPECTED_MOCKUP_SCREEN_CODES = [
  'MH-001',
  'MH-006',
  'MH-012',
  'MH-018',
  'MH-022',
  'MH-030',
  'MH-033',
  'MH-036',
  'MH-042',
  'MH-046',
  'MH-052',
  'MH-058',
] as const;

const EXPECTED_MOCKUP_FILENAMES = [
  'srs-3-01-affiliate-center-eligibility-mockup.png',
  'srs-3-02-affiliate-dashboard-mockup.png',
  'srs-3-03-tracked-link-builder-mockup.png',
  'srs-3-04-attribution-decision-mockup.png',
  'srs-3-05-public-video-feed-mockup.png',
  'srs-3-06-public-viewer-room-mockup.png',
  'srs-3-07-commission-rates-mockup.png',
  'srs-3-08-collaboration-inbox-mockup.png',
  'srs-3-09-roster-management-mockup.png',
  'srs-3-10-creator-wallet-mockup.png',
  'srs-3-11-risk-queue-mockup.png',
  'srs-3-12-product-feed-health-mockup.png',
] as const;

const EXPECTED_WIREFRAME_FILENAMES = [
  'mh-001-affiliate-center-eligibility-wireframe.png',
  'mh-002-affiliate-application-wireframe.png',
  'mh-003-channel-verification-wireframe.png',
  'mh-004-affiliate-settings-wireframe.png',
  'mh-005-affiliate-review-wireframe.png',
  'mh-006-affiliate-dashboard-wireframe.png',
  'mh-007-product-marketplace-wireframe.png',
  'mh-008-offer-detail-wireframe.png',
  'mh-009-offer-invitation-wireframe.png',
  'mh-010-referral-wireframe.png',
  'mh-011-offer-management-wireframe.png',
  'mh-012-tracked-link-builder-wireframe.png',
  'mh-013-product-code-generator-wireframe.png',
  'mh-014-collection-manager-wireframe.png',
  'mh-015-public-buyer-pdp-wireframe.png',
  'mh-016-conversion-report-wireframe.png',
  'mh-017-earnings-report-wireframe.png',
  'mh-018-attribution-decision-wireframe.png',
  'mh-019-rate-simulator-wireframe.png',
  'mh-020-commission-ledger-wireframe.png',
  'mh-021-attribution-explorer-wireframe.png',
  'mh-022-public-video-feed-wireframe.png',
  'mh-023-video-composer-wireframe.png',
  'mh-024-product-picker-wireframe.png',
  'mh-025-buyer-detail-sheet-wireframe.png',
  'mh-026-moderation-appeal-wireframe.png',
  'mh-027-live-discovery-wireframe.png',
  'mh-028-live-setup-wireframe.png',
  'mh-029-live-host-console-wireframe.png',
  'mh-030-public-viewer-room-wireframe.png',
  'mh-031-live-replay-wireframe.png',
  'mh-032-pps-enrollment-wireframe.png',
  'mh-033-commission-rates-wireframe.png',
  'mh-034-creator-directory-wireframe.png',
  'mh-035-contact-consent-wireframe.png',
  'mh-036-collaboration-inbox-wireframe.png',
  'mh-037-proposal-contract-wireframe.png',
  'mh-038-sample-tracker-wireframe.png',
  'mh-039-deliverable-review-wireframe.png',
  'mh-040-seller-affiliate-dashboard-wireframe.png',
  'mh-041-mcn-application-wireframe.png',
  'mh-042-roster-management-wireframe.png',
  'mh-043-rbac-management-wireframe.png',
  'mh-044-campaign-assignment-wireframe.png',
  'mh-045-settlement-report-wireframe.png',
  'mh-046-creator-wallet-wireframe.png',
  'mh-047-tax-payment-setup-wireframe.png',
  'mh-048-earnings-statement-wireframe.png',
  'mh-049-payout-remediation-wireframe.png',
  'mh-050-finance-reconciliation-wireframe.png',
  'mh-051-fraud-report-wireframe.png',
  'mh-052-risk-queue-wireframe.png',
  'mh-053-case-graph-wireframe.png',
  'mh-054-enforcement-appeal-wireframe.png',
  'mh-055-policy-recall-wireframe.png',
  'mh-056-external-property-registry-wireframe.png',
  'mh-057-youtube-oauth-connection-wireframe.png',
  'mh-058-product-feed-health-wireframe.png',
  'mh-059-channel-report-wireframe.png',
] as const;

const EXPECTED_CAPTION =
  'Visual aid; component contract và nội dung SRS chuẩn tắc vẫn là nguồn quyết định.';

const EXPECTED_AUTHORITATIVE_TITLES = [
  'Affiliate Center & Eligibility',
  'Affiliate Application',
  'Channel & Property Verification',
  'Affiliate Settings: Profile, Tax & Payment',
  'Affiliate Application Review',
  'Affiliate Performance Dashboard',
  'Commission & Product Marketplace',
  'Offer Detail & Asset Creation',
  'Invitations & Programs',
  'Affiliate Referral',
  'Affiliate Offer Management',
  'Custom Link Builder',
  'Product Code Generator',
  'Collection Manager',
  'Public Creator Collection',
  'Click & Conversion Reports',
  'Earnings & Payment History',
  'Conversion Detail & Attribution Explanation',
  'Seller Rate Plan & Simulator',
  'Creator Earning Ledger',
  'Attribution Explorer',
  'Video Feed',
  'Video Composer',
  'Video Product & Voucher Picker',
  'Video Detail & Product Sheet',
  'Video Moderation & Appeal',
  'LIVE Discovery',
  'LIVE Setup & Schedule',
  'Host Console',
  'Viewer LIVE Room',
  'LIVE Moderation & Replay',
  'PPS Enrollment',
  'Product Commission Rates',
  'Creator Directory',
  'Creator Contact & Consent',
  'Collaboration Inbox',
  'Proposal & Contract Editor',
  'Sample Tracker',
  'Deliverable Submission & Review',
  'Seller Affiliate Dashboard',
  'MCN Application',
  'Roster & Invitations',
  'Sub-account & RBAC',
  'Campaign Assignments',
  'MCN Reports & Settlement',
  'Creator Wallet',
  'Tax & Payment Setup',
  'Period Statement',
  'Payout Notifications & Remediation',
  'Finance Reconciliation Console',
  'Affiliate Fraud Report',
  'Risk Case Queue',
  'Case Detail & Entity Graph',
  'Enforcement Appeal',
  'Policy & Recall Console',
  'Channel & Property Registry',
  'YouTube Shopping Connect',
  'External Product Tagging & Feed Health',
  'External Channel Report',
] as const;

const EXPECTED_SCREEN_CODES = Array.from(
  { length: 59 },
  (_, index) => `MH-${String(index + 1).padStart(3, '0')}`,
);

describe('[SRSWireframeManifest]', () => {
  it('should freeze the twelve existing Page 3 UI targets', () => {
    assert.equal(UI_WIREFRAME_PAGES.length, 12);
    assert.deepEqual(
      UI_WIREFRAME_PAGES.map((page) => page.pageKey),
      EXPECTED_PAGE_KEYS,
    );
    assert.deepEqual(
      UI_WIREFRAME_PAGES.map((page) => page.pageId),
      EXPECTED_PAGE_IDS,
    );
    assert.deepEqual(
      UI_WIREFRAME_PAGES.map((page) => page.expectedImageTotal),
      EXPECTED_PAGE_IMAGE_TOTALS,
    );
  });

  it('should freeze the exact component-contract insertion anchor', () => {
    assert.deepEqual(
      UI_WIREFRAME_PAGES.map((page) => page.insertBefore),
      Array.from({ length: 12 }, () => EXPECTED_INSERT_BEFORE),
    );
  });

  it('should freeze all twelve backend related-page links', () => {
    assert.deepEqual(
      UI_WIREFRAME_PAGES.map((page) => page.relatedPageUrl),
      EXPECTED_RELATED_PAGE_URLS,
    );
  });

  it('should cover MH-001 through MH-059 exactly once in page ranges', () => {
    assert.equal(WIREFRAME_TARGETS.length, 59);
    assert.deepEqual(
      WIREFRAME_TARGETS.map((target) => target.code),
      EXPECTED_SCREEN_CODES,
    );
    assert.deepEqual(
      UI_WIREFRAME_PAGES.flatMap((page) => page.screenCodes),
      EXPECTED_SCREEN_CODES,
    );
    assert.equal(
      new Set(WIREFRAME_TARGETS.map((target) => target.code)).size,
      59,
    );
  });

  it('should freeze all authoritative Notion screen titles', () => {
    assert.deepEqual(
      WIREFRAME_TARGETS.map((target) => target.screenTitle),
      EXPECTED_AUTHORITATIVE_TITLES,
    );
  });

  it('should derive MH-001 alt from its authoritative title', () => {
    assert.equal(
      WIREFRAME_TARGETS.at(0)?.alt,
      'Wireframe desktop MH-001 thể hiện component contract, required state, validation, binding và recovery của Affiliate Center & Eligibility.',
    );
  });

  it('should freeze the twelve approved high-fidelity representatives', () => {
    assert.deepEqual(MOCKUP_SCREEN_CODES, EXPECTED_MOCKUP_SCREEN_CODES);
    assert.deepEqual(
      MOCKUP_TARGETS.map((target) => target.screenCode),
      EXPECTED_MOCKUP_SCREEN_CODES,
    );
    assert.deepEqual(
      MOCKUP_TARGETS.map((target) => target.pageKey),
      EXPECTED_PAGE_KEYS,
    );
    assert.deepEqual(
      MOCKUP_TARGETS.map((target) => target.filename),
      EXPECTED_MOCKUP_FILENAMES,
    );
  });

  it('should expose the representative code tuple as runtime immutable', () => {
    assert.equal(Object.isFrozen(MOCKUP_SCREEN_CODES), true);
  });

  it('should derive seventy-one unique stable PNG filenames', () => {
    const targets = [...WIREFRAME_TARGETS, ...MOCKUP_TARGETS];
    const filenames = targets.map((target) => target.filename);

    assert.equal(targets.length, 71);
    assert.equal(new Set(filenames).size, 71);
    assert.ok(
      filenames.every((filename) => /^[a-z0-9-]+\.png$/.test(filename)),
    );
    assert.deepEqual(
      WIREFRAME_TARGETS.map((target) => target.filename),
      EXPECTED_WIREFRAME_FILENAMES,
    );
    assert.equal(
      MOCKUP_TARGETS.at(0)?.filename,
      'srs-3-01-affiliate-center-eligibility-mockup.png',
    );
    assert.equal(
      MOCKUP_TARGETS.at(-1)?.filename,
      'srs-3-12-product-feed-health-mockup.png',
    );
  });

  it('should derive the exact wireframe alt template', () => {
    for (const target of WIREFRAME_TARGETS) {
      assert.equal(
        target.alt,
        `Wireframe desktop ${target.screenCode} thể hiện component contract, required state, validation, binding và recovery của ${target.screenTitle}.`,
      );
    }
  });

  it('should derive the exact mockup alt template', () => {
    for (const target of MOCKUP_TARGETS) {
      assert.equal(
        target.alt,
        `Mockup high-fidelity trang ${target.pageLabel} cho ${target.screenCode}, sử dụng Benadep Luxury Blush và dữ liệu placeholder trung tính.`,
      );
    }
  });

  it('should publish the exact normative visual-aid caption', () => {
    for (const target of [...WIREFRAME_TARGETS, ...MOCKUP_TARGETS]) {
      assert.equal(target.caption, EXPECTED_CAPTION);
    }
  });
});
