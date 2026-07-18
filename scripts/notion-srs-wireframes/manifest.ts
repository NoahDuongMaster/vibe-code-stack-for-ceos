import { DIAGRAM_TARGETS } from '../notion-srs-visuals/manifest.ts';

import type {
  TScreenCode,
  TScreenVisualTarget,
  TUiPageKey,
  TUiWireframePage,
} from './types.ts';

const EXPECTED_UI_PAGE_KEYS = [
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
] as const satisfies readonly TUiPageKey[];

const EXPECTED_INSERT_BEFORE = '### Quy ước Component Contract';

const EXPECTED_RELATED_PAGE_URL_BY_KEY = {
  '3-01-ui': 'https://app.notion.com/p/a0fad27c837882bd8a5781a0ce5ef4a6',
  '3-02-ui': 'https://app.notion.com/p/3a0ad27c83788175ad48e3637264a0c6',
  '3-03-ui': 'https://app.notion.com/p/3a0ad27c8378815a9ebee9c2cfca01c7',
  '3-04-ui': 'https://app.notion.com/p/3a0ad27c837881859fcad6114eed59a0',
  '3-05-ui': 'https://app.notion.com/p/3a0ad27c837881c1b06ddf6cee307cb4',
  '3-06-ui': 'https://app.notion.com/p/3a0ad27c837881e09720ee71d2a4239a',
  '3-07-ui': 'https://app.notion.com/p/3a0ad27c837881568f2ed253143d14b1',
  '3-08-ui': 'https://app.notion.com/p/3a0ad27c8378817b8d1ac107731cc836',
  '3-09-ui': 'https://app.notion.com/p/3a0ad27c83788133902fe4ce1910435e',
  '3-10-ui': 'https://app.notion.com/p/3a0ad27c8378814d9d0fe3849c42f3fc',
  '3-11-ui': 'https://app.notion.com/p/3a0ad27c837881348366cc8572374d38',
  '3-12-ui': 'https://app.notion.com/p/3a0ad27c837881b4beb5e186e857672b',
} as const satisfies Readonly<Partial<Record<TUiPageKey, string>>>;

const EXPECTED_PAGE_IMAGE_TOTALS = [
  7, 8, 8, 6, 7, 7, 6, 7, 7, 7, 7, 6,
] as const;

// Snapshot of the authoritative MH headings fetched from the twelve Notion UI
// pages. Task 2 must cross-check every entry against the normalized contracts.
const AUTHORITATIVE_SCREEN_TITLE_BY_CODE = {
  'MH-001': 'Affiliate Center & Eligibility',
  'MH-002': 'Affiliate Application',
  'MH-003': 'Channel & Property Verification',
  'MH-004': 'Affiliate Settings: Profile, Tax & Payment',
  'MH-005': 'Affiliate Application Review',
  'MH-006': 'Affiliate Performance Dashboard',
  'MH-007': 'Commission & Product Marketplace',
  'MH-008': 'Offer Detail & Asset Creation',
  'MH-009': 'Invitations & Programs',
  'MH-010': 'Affiliate Referral',
  'MH-011': 'Affiliate Offer Management',
  'MH-012': 'Custom Link Builder',
  'MH-013': 'Product Code Generator',
  'MH-014': 'Collection Manager',
  'MH-015': 'Public Creator Collection',
  'MH-016': 'Click & Conversion Reports',
  'MH-017': 'Earnings & Payment History',
  'MH-018': 'Conversion Detail & Attribution Explanation',
  'MH-019': 'Seller Rate Plan & Simulator',
  'MH-020': 'Creator Earning Ledger',
  'MH-021': 'Attribution Explorer',
  'MH-022': 'Video Feed',
  'MH-023': 'Video Composer',
  'MH-024': 'Video Product & Voucher Picker',
  'MH-025': 'Video Detail & Product Sheet',
  'MH-026': 'Video Moderation & Appeal',
  'MH-027': 'LIVE Discovery',
  'MH-028': 'LIVE Setup & Schedule',
  'MH-029': 'Host Console',
  'MH-030': 'Viewer LIVE Room',
  'MH-031': 'LIVE Moderation & Replay',
  'MH-032': 'PPS Enrollment',
  'MH-033': 'Product Commission Rates',
  'MH-034': 'Creator Directory',
  'MH-035': 'Creator Contact & Consent',
  'MH-036': 'Collaboration Inbox',
  'MH-037': 'Proposal & Contract Editor',
  'MH-038': 'Sample Tracker',
  'MH-039': 'Deliverable Submission & Review',
  'MH-040': 'Seller Affiliate Dashboard',
  'MH-041': 'MCN Application',
  'MH-042': 'Roster & Invitations',
  'MH-043': 'Sub-account & RBAC',
  'MH-044': 'Campaign Assignments',
  'MH-045': 'MCN Reports & Settlement',
  'MH-046': 'Creator Wallet',
  'MH-047': 'Tax & Payment Setup',
  'MH-048': 'Period Statement',
  'MH-049': 'Payout Notifications & Remediation',
  'MH-050': 'Finance Reconciliation Console',
  'MH-051': 'Affiliate Fraud Report',
  'MH-052': 'Risk Case Queue',
  'MH-053': 'Case Detail & Entity Graph',
  'MH-054': 'Enforcement Appeal',
  'MH-055': 'Policy & Recall Console',
  'MH-056': 'Channel & Property Registry',
  'MH-057': 'YouTube Shopping Connect',
  'MH-058': 'External Product Tagging & Feed Health',
  'MH-059': 'External Channel Report',
} as const satisfies Readonly<Partial<Record<TScreenCode, string>>>;

const SCREEN_SLUG_SOURCE_BY_CODE = {
  'MH-001': 'affiliate center eligibility',
  'MH-002': 'affiliate application',
  'MH-003': 'channel verification',
  'MH-004': 'affiliate settings',
  'MH-005': 'affiliate review',
  'MH-006': 'affiliate dashboard',
  'MH-007': 'product marketplace',
  'MH-008': 'offer detail',
  'MH-009': 'offer invitation',
  'MH-010': 'referral',
  'MH-011': 'offer management',
  'MH-012': 'tracked link builder',
  'MH-013': 'product code generator',
  'MH-014': 'collection manager',
  'MH-015': 'public buyer pdp',
  'MH-016': 'conversion report',
  'MH-017': 'earnings report',
  'MH-018': 'attribution decision',
  'MH-019': 'rate simulator',
  'MH-020': 'commission ledger',
  'MH-021': 'attribution explorer',
  'MH-022': 'public video feed',
  'MH-023': 'video composer',
  'MH-024': 'product picker',
  'MH-025': 'buyer detail sheet',
  'MH-026': 'moderation appeal',
  'MH-027': 'live discovery',
  'MH-028': 'live setup',
  'MH-029': 'live host console',
  'MH-030': 'public viewer room',
  'MH-031': 'live replay',
  'MH-032': 'pps enrollment',
  'MH-033': 'commission rates',
  'MH-034': 'creator directory',
  'MH-035': 'contact consent',
  'MH-036': 'collaboration inbox',
  'MH-037': 'proposal contract',
  'MH-038': 'sample tracker',
  'MH-039': 'deliverable review',
  'MH-040': 'seller affiliate dashboard',
  'MH-041': 'mcn application',
  'MH-042': 'roster management',
  'MH-043': 'rbac management',
  'MH-044': 'campaign assignment',
  'MH-045': 'settlement report',
  'MH-046': 'creator wallet',
  'MH-047': 'tax payment setup',
  'MH-048': 'earnings statement',
  'MH-049': 'payout remediation',
  'MH-050': 'finance reconciliation',
  'MH-051': 'fraud report',
  'MH-052': 'risk queue',
  'MH-053': 'case graph',
  'MH-054': 'enforcement appeal',
  'MH-055': 'policy recall',
  'MH-056': 'external property registry',
  'MH-057': 'youtube oauth connection',
  'MH-058': 'product feed health',
  'MH-059': 'channel report',
} as const satisfies Readonly<Partial<Record<TScreenCode, string>>>;

type TScreenDescriptor = Readonly<{
  code: TScreenCode;
  title: string;
  slug: string;
}>;

const fail = (message: string): never => {
  throw new Error(`Invalid SRS wireframe manifest: ${message}`);
};

const formatScreenCode = (value: number): TScreenCode => {
  if (!Number.isInteger(value) || value < 1 || value > 59) {
    return fail(`screen sequence must be between 1 and 59, found ${value}`);
  }

  return `MH-${String(value).padStart(3, '0')}` as TScreenCode;
};

const asUiPageKey = (value: string): TUiPageKey => {
  if (!/^3-(0[1-9]|1[0-2])-ui$/.test(value)) {
    return fail(`unexpected Page 3 key ${value}`);
  }

  return value as TUiPageKey;
};

const parseScreenRange = (value: string): readonly TScreenCode[] => {
  const match = /^MH-(\d{3})–MH-(\d{3})$/.exec(value);
  const startText = match?.[1];
  const endText = match?.[2];

  if (!startText || !endText) {
    return fail(`unexpected MH range ${value}`);
  }

  const start = Number(startText);
  const end = Number(endText);
  if (start > end) {
    return fail(`descending MH range ${value}`);
  }

  return Object.freeze(
    Array.from({ length: end - start + 1 }, (_, index) =>
      formatScreenCode(start + index),
    ),
  );
};

const SOURCE_UI_PAGES = DIAGRAM_TARGETS.filter(
  (target) => target.kind === 'ui',
);

if (SOURCE_UI_PAGES.length !== EXPECTED_UI_PAGE_KEYS.length) {
  fail(`expected 12 UI pages, found ${SOURCE_UI_PAGES.length}`);
}

export const UI_WIREFRAME_PAGES: readonly TUiWireframePage[] = Object.freeze(
  SOURCE_UI_PAGES.map((source, index) => {
    const pageKey = asUiPageKey(source.key);
    const expectedKey = EXPECTED_UI_PAGE_KEYS[index];
    if (pageKey !== expectedKey) {
      return fail(`expected page ${expectedKey}, found ${pageKey}`);
    }
    if (source.insertBefore !== EXPECTED_INSERT_BEFORE) {
      return fail(`unexpected insertion anchor for ${pageKey}`);
    }
    const expectedRelatedPageUrl = EXPECTED_RELATED_PAGE_URL_BY_KEY[pageKey];
    if (
      !expectedRelatedPageUrl ||
      source.relatedPageUrl !== expectedRelatedPageUrl
    ) {
      return fail(`unexpected related-page URL for ${pageKey}`);
    }

    const screenCodes = parseScreenRange(source.codeRange);
    const expectedImageTotal = screenCodes.length + 2;
    if (expectedImageTotal !== EXPECTED_PAGE_IMAGE_TOTALS[index]) {
      return fail(
        `expected ${EXPECTED_PAGE_IMAGE_TOTALS[index]} images on ${pageKey}, found ${expectedImageTotal}`,
      );
    }

    return Object.freeze({
      pageKey,
      pageId: source.pageId,
      pageLabel: source.pageLabel,
      title: source.title,
      codeRange: source.codeRange,
      insertBefore: source.insertBefore,
      relatedPageUrl: source.relatedPageUrl,
      screenCodes,
      expectedImageTotal,
    });
  }),
);

const EXPECTED_SCREEN_CODES = Array.from({ length: 59 }, (_, index) =>
  formatScreenCode(index + 1),
);
const PAGE_SCREEN_CODES = UI_WIREFRAME_PAGES.flatMap(
  (page) => page.screenCodes,
);

if (
  PAGE_SCREEN_CODES.length !== EXPECTED_SCREEN_CODES.length ||
  PAGE_SCREEN_CODES.some((code, index) => code !== EXPECTED_SCREEN_CODES[index])
) {
  fail('Page 3 MH ranges must cover MH-001 through MH-059 exactly once');
}

if (
  Object.keys(AUTHORITATIVE_SCREEN_TITLE_BY_CODE).length !==
  EXPECTED_SCREEN_CODES.length
) {
  fail(
    `expected 59 authoritative screen titles, found ${Object.keys(AUTHORITATIVE_SCREEN_TITLE_BY_CODE).length}`,
  );
}

const authoritativeScreenTitleByCode: Readonly<
  Partial<Record<TScreenCode, string>>
> = AUTHORITATIVE_SCREEN_TITLE_BY_CODE;

const slugify = (value: string): string => {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || fail(`cannot derive slug from ${value}`);
};

if (
  Object.keys(SCREEN_SLUG_SOURCE_BY_CODE).length !==
  EXPECTED_SCREEN_CODES.length
) {
  fail(
    `expected 59 screen slug sources, found ${Object.keys(SCREEN_SLUG_SOURCE_BY_CODE).length}`,
  );
}

const screenSlugSourceByCode: Readonly<Partial<Record<TScreenCode, string>>> =
  SCREEN_SLUG_SOURCE_BY_CODE;

const SCREEN_DESCRIPTORS: readonly TScreenDescriptor[] = Object.freeze(
  EXPECTED_SCREEN_CODES.map((code) => {
    const title = authoritativeScreenTitleByCode[code];
    if (!title) {
      return fail(`missing authoritative screen title for ${code}`);
    }
    const slugSource = screenSlugSourceByCode[code];
    if (!slugSource) {
      return fail(`missing screen slug source for ${code}`);
    }

    return Object.freeze({ code, title, slug: slugify(slugSource) });
  }),
);

const pageByScreenCode = new Map<TScreenCode, TUiWireframePage>();
for (const page of UI_WIREFRAME_PAGES) {
  for (const code of page.screenCodes) {
    if (pageByScreenCode.has(code)) {
      fail(`screen ${code} belongs to more than one UI page`);
    }
    pageByScreenCode.set(code, page);
  }
}

const createVisualTarget = (
  kind: TScreenVisualTarget['kind'],
  screen: TScreenDescriptor,
): TScreenVisualTarget => {
  const page = pageByScreenCode.get(screen.code);
  if (!page) {
    return fail(`missing UI page for ${screen.code}`);
  }

  const pageNumber = page.pageLabel.replace('.', '-');
  const filename =
    kind === 'wireframe'
      ? `${screen.code.toLowerCase()}-${screen.slug}-wireframe.png`
      : `srs-${pageNumber}-${screen.slug}-mockup.png`;
  const alt =
    kind === 'wireframe'
      ? `Wireframe desktop ${screen.code} thể hiện component contract, required state, validation, binding và recovery của ${screen.title}.`
      : `Mockup high-fidelity trang ${page.pageLabel} cho ${screen.code}, sử dụng Benadep Luxury Blush và dữ liệu placeholder trung tính.`;
  const caption =
    'Visual aid; component contract và nội dung SRS chuẩn tắc vẫn là nguồn quyết định.';

  return Object.freeze({
    kind,
    code: screen.code,
    screenCode: screen.code,
    screenTitle: screen.title,
    screenSlug: screen.slug,
    pageKey: page.pageKey,
    pageId: page.pageId,
    pageLabel: page.pageLabel,
    filename,
    alt,
    caption,
  });
};

export const WIREFRAME_TARGETS: readonly TScreenVisualTarget[] = Object.freeze(
  SCREEN_DESCRIPTORS.map((screen) => createVisualTarget('wireframe', screen)),
);

export const MOCKUP_SCREEN_CODES = Object.freeze([
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
] as const satisfies readonly TScreenCode[]);

const descriptorByCode = new Map(
  SCREEN_DESCRIPTORS.map((screen) => [screen.code, screen] as const),
);

export const MOCKUP_TARGETS: readonly TScreenVisualTarget[] = Object.freeze(
  MOCKUP_SCREEN_CODES.map((code) => {
    const screen = descriptorByCode.get(code);
    return screen
      ? createVisualTarget('mockup', screen)
      : fail(`missing mockup screen ${code}`);
  }),
);

const ALL_FILENAMES = [...WIREFRAME_TARGETS, ...MOCKUP_TARGETS].map(
  (target) => target.filename,
);
if (ALL_FILENAMES.length !== 71 || new Set(ALL_FILENAMES).size !== 71) {
  fail('wireframe and mockup targets must define 71 unique filenames');
}
