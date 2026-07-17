import { TARGET_BY_KEY } from './manifest.ts';

import type {
  TBadge,
  TDiagramColumn,
  TDiagramEdge,
  TDiagramNode,
  TDiagramSpec,
  TEdgeStyle,
  TTone,
} from './types.ts';

const metadata = (
  key: string,
  scope: string,
): Pick<TDiagramSpec, 'key' | 'title' | 'subtitle' | 'scope'> => {
  const target = TARGET_BY_KEY.get(key);
  if (!target) {
    throw new Error(`Unknown diagram target: ${key}`);
  }

  return {
    key: target.key,
    title: target.title,
    subtitle: target.codeRange,
    scope,
  };
};

const node = (
  id: string,
  label: string,
  detail: string,
  tone: TTone,
  badge: TBadge,
): TDiagramNode => ({ id, label, detail, tone, badge });

const column = (
  title: string,
  ...nodes: readonly TDiagramNode[]
): TDiagramColumn => ({ title, nodes });

const edge = (
  from: string,
  to: string,
  label: string,
  style: TEdgeStyle = 'solid',
): TDiagramEdge => ({ from, to, label, style });

const spec = (
  key: string,
  scope: string,
  columns: readonly TDiagramColumn[],
  edges: readonly TDiagramEdge[],
): TDiagramSpec => ({ ...metadata(key, scope), columns, edges });

export const BACKEND_SPECS = [
  spec(
    '2-01-backend',
    'Affiliate application, verification, review, account state, safe remediation, and retained decision evidence.',
    [
      column(
        'Application',
        node(
          'application',
          'CN-001 Application',
          'Application draft is saved before the creator submits a versioned record.',
          'creator',
          'New',
        ),
      ),
      column(
        'Verification',
        node(
          'identity',
          'CN-003 Identity',
          'Identity/contact status extends the existing account boundary without storing raw provider data.',
          'creator',
          'Extend',
        ),
        node(
          'channel',
          'Channel ownership',
          'Channel ownership verification records method, result, and verified property.',
          'system',
          'New',
        ),
      ),
      column(
        'Decision',
        node(
          'review',
          'Admin review',
          'Admin review returns active, needs_action, or rejected with a safe reason code.',
          'ops',
          'Extend',
        ),
      ),
      column(
        'Account lifecycle',
        node(
          'suspension',
          'Suspension',
          'Suspension and reverification preserve independent account and verification states.',
          'ops',
          'New',
        ),
        node(
          '2-01-backend-remediation',
          'Safe reverification',
          'Safe appeal or reverification returns the user to the exact required evidence step.',
          'creator',
          'New',
        ),
        node(
          'native-parity-gate',
          'CN-004 Native parity gate',
          'Parity closes only after an approved ADR, native implementation, and authenticated field evidence.',
          'system',
          'Field-validation gate',
        ),
      ),
      column(
        'Evidence',
        node(
          'evidence',
          'Versioned evidence',
          'Versioned evidence retains actor, input, policy, result, timestamp, and reference.',
          'system',
          'Extend',
        ),
      ),
    ],
    [
      edge('application', 'identity', 'submitted'),
      edge('identity', 'review', 'verified'),
      edge('channel', 'review', 'ownership result', 'dashed'),
      edge('review', 'suspension', 'state transition'),
      edge('review', '2-01-backend-remediation', 'needs action'),
      edge('review', 'evidence', 'decision proof', 'dotted'),
      edge(
        '2-01-backend-remediation',
        'evidence',
        'remediation proof',
        'dotted',
      ),
      edge('native-parity-gate', 'evidence', 'release-gate proof', 'dotted'),
    ],
  ),
  spec(
    '2-02-backend',
    'Versioned offer discovery, eligibility, enrollment, asset creation, aggregated performance, and stale-data recovery.',
    [
      column(
        'Discover',
        node(
          'dashboard',
          'CN-010 Dashboard',
          'Dashboard query reuses authenticated seller, product, and order summaries.',
          'creator',
          'Extend',
        ),
      ),
      column(
        'Offer policy',
        node(
          'offer',
          'CN-011–015 Offer',
          'Offer and rate version are immutable for each eligibility decision.',
          'seller',
          'New',
        ),
        node(
          'eligibility',
          'Eligibility',
          'Eligibility evaluates the published version and returns explainable outcome codes.',
          'system',
          'New',
        ),
      ),
      column(
        'Participate',
        node(
          'enrollment',
          'Invitation / enrollment',
          'Invitation and enrollment bind creator, seller, offer version, and effective status.',
          'creator',
          'New',
        ),
        node(
          'asset',
          'Affiliate asset',
          'Link/content/referral asset retains offer and channel context.',
          'creator',
          'New',
        ),
      ),
      column(
        'Measure safely',
        node(
          'aggregate',
          'Performance aggregate',
          'Aggregated click/order/earning metrics state their freshness and definition.',
          'money',
          'Extend',
        ),
        node(
          '2-02-backend-remediation',
          'Safe version refresh',
          'Safe retry refreshes a stale offer before enrollment or asset mutation.',
          'system',
          'Extend',
        ),
      ),
      column(
        'Evidence',
        node(
          'offer-evidence',
          'Audit / freshness',
          'Audit stores query watermark, offer version, aggregation window, and correlation reference.',
          'system',
          'Existing',
        ),
      ),
    ],
    [
      edge('dashboard', 'offer', 'query offers'),
      edge('offer', 'enrollment', 'eligible version'),
      edge('eligibility', 'enrollment', 'decision'),
      edge('enrollment', 'aggregate', 'asset events', 'dashed'),
      edge('asset', 'aggregate', 'click and order', 'dashed'),
      edge('offer', '2-02-backend-remediation', 'stale version'),
      edge('aggregate', 'offer-evidence', 'metric proof', 'dotted'),
      edge(
        '2-02-backend-remediation',
        'offer-evidence',
        'refresh proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-03-backend',
    'Tracked asset resolution, click evidence, order-line conversion, reporting, payment detail, export, and context-preserving recovery.',
    [
      column(
        'Create assets',
        node(
          'link',
          'CN-020 Link',
          'Tracked link binds creator, product, channel, campaign, and sub-ID context.',
          'creator',
          'New',
        ),
        node(
          'code',
          'CN-021 Code',
          'Code resolves through a versioned, collision-safe product association.',
          'creator',
          'New',
        ),
        node(
          'collection',
          'CN-022 Collection',
          'Collection publication snapshots ordered products and disclosure context.',
          'creator',
          'New',
        ),
      ),
      column(
        'Resolve',
        node(
          'resolver',
          'Resolver / redirect',
          'Resolver validates the token, preserves source context, and performs a safe redirect.',
          'system',
          'Extend',
        ),
      ),
      column(
        'Observe commerce',
        node(
          'click-proof',
          'Click evidence',
          'Click evidence records privacy-safe source, target, time, consent, and dedup status.',
          'system',
          'New',
        ),
        node(
          'conversion',
          'Order-line conversion',
          'Order-line conversion extends authoritative checkout and order events.',
          'money',
          'Extend',
        ),
      ),
      column(
        'Report & recover',
        node(
          'reports',
          'CN-023–025 Reports',
          'Reports expose clicks and conversions with filters, definitions, and drill-down.',
          'creator',
          'New',
        ),
        node(
          'earnings',
          'CN-026–027 Earnings',
          'Earnings/payment/export preserves statement period, amount, state, and source.',
          'money',
          'New',
        ),
        node(
          '2-03-backend-remediation',
          'Safe resolver retry',
          'Safe retry retains source context and returns an actionable resolver error.',
          'system',
          'Extend',
        ),
      ),
      column(
        'Evidence',
        node(
          'report-evidence',
          'Versioned report proof',
          'Immutable click, order-line, query, and export references support replay.',
          'system',
          'Existing',
        ),
      ),
    ],
    [
      edge('link', 'resolver', 'open'),
      edge('code', 'resolver', 'resolve'),
      edge('collection', 'resolver', 'select product'),
      edge('resolver', 'click-proof', 'valid source'),
      edge('click-proof', 'conversion', 'order-line event', 'dashed'),
      edge('conversion', 'reports', 'attributed order line', 'dashed'),
      edge('reports', 'earnings', 'earning detail'),
      edge('resolver', '2-03-backend-remediation', 'invalid or expired'),
      edge('reports', 'report-evidence', 'query proof', 'dotted'),
      edge('earnings', 'report-evidence', 'financial proof', 'dotted'),
    ],
  ),
  spec(
    '2-04-backend',
    'Replayable deterministic candidate selection, versioned attribution outcome, immutable rate snapshot, order-line journal, and safe appeal.',
    [
      column(
        'Observe',
        node(
          'touchpoints',
          'CN-028 Touchpoints',
          'Eligible touchpoints inside the configured window form a bounded input set.',
          'system',
          'New',
        ),
        node(
          'candidates',
          'Candidate set',
          'Candidate set retains accepted and rejected candidates with reason codes.',
          'system',
          'New',
        ),
      ),
      column(
        'Decide',
        node(
          'class',
          'CN-031–034 Class',
          'Deterministic class and precedence use observable, versioned inputs and remain field-validation gated.',
          'system',
          'Field-validation gate',
        ),
        node(
          'winner',
          'Winner / version',
          'Winner stores the policy version, candidate reasons, and deterministic observable outcome.',
          'system',
          'New',
        ),
      ),
      column(
        'Snapshot money',
        node(
          'rate',
          'CN-029–030 Rate',
          'Rate snapshot freezes eligible product, seller, creator, basis, and effective policy.',
          'money',
          'New',
        ),
      ),
      column(
        'Journal & recover',
        node(
          'ledger',
          'CN-035–039 Ledger',
          'Order-line ledger/adjustment uses append-only entries and balanced references.',
          'money',
          'New',
        ),
        node(
          '2-04-backend-remediation',
          'Safe evidence replay',
          'Safe appeal replays candidates, winner, rate snapshot, and adjustment without mutation.',
          'ops',
          'Extend',
        ),
      ),
      column(
        'Evidence',
        node(
          'attribution-evidence',
          'Evidence replay',
          'Existing order events plus versioned inputs support deterministic evidence replay.',
          'system',
          'Existing',
        ),
      ),
    ],
    [
      edge('touchpoints', 'candidates', 'within window'),
      edge('candidates', 'class', 'eligible set'),
      edge('class', 'winner', 'deterministic outcome'),
      edge('winner', 'rate', 'winner version'),
      edge('rate', 'ledger', 'order-line snapshot'),
      edge('ledger', 'attribution-evidence', 'journal proof', 'dotted'),
      edge('winner', 'attribution-evidence', 'decision proof', 'dotted'),
      edge('rate', '2-04-backend-remediation', 'dispute reference'),
      edge(
        '2-04-backend-remediation',
        'attribution-evidence',
        'replay proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-05-backend',
    'Short Video media processing, product association, immutable publication, commerce evidence, moderation, and appeal.',
    [
      column(
        'Draft media',
        node(
          'video-draft',
          'CN-041 Media draft',
          'Upload/transcode draft extends safe file processing with creator ownership.',
          'creator',
          'Extend',
        ),
      ),
      column(
        'Moderate & decorate',
        node(
          'video-moderation',
          'CN-045 Moderation',
          'Pre-publish checks and post-publish actions return policy version, safe reason, scope, and reference.',
          'ops',
          'Extend',
        ),
        node(
          'video-tags',
          'CN-042/044 Tags',
          'Product tags/voucher references are validated before publication.',
          'creator',
          'New',
        ),
        node(
          'catalog-reference',
          'Catalog reference',
          'Existing product and voucher state remains authoritative.',
          'seller',
          'Existing',
        ),
      ),
      column(
        'Publish & discover',
        node(
          'video-publish',
          'Immutable publish',
          'Publish creates an immutable version of content, tags, and disclosure evidence.',
          'creator',
          'New',
        ),
        node(
          'video-feed',
          'CN-040 Feed / detail',
          'Feed/detail extends community discovery with the immutable affiliate video version.',
          'creator',
          'Extend',
        ),
      ),
      column(
        'Commerce & control',
        node(
          'video-commerce',
          'CN-043 Commerce',
          'Commerce click/order evidence links video, product, voucher, touchpoint, and order line.',
          'money',
          'New',
        ),
        node(
          '2-05-backend-remediation',
          'Safe content appeal',
          'Safe appeal preserves the published version and submits bounded evidence.',
          'creator',
          'New',
        ),
      ),
      column(
        'Evidence',
        node(
          'video-evidence',
          'Versioned evidence',
          'Media, tags, publish, commerce, moderation, and appeal evidence remain replayable.',
          'system',
          'Extend',
        ),
      ),
    ],
    [
      edge('video-draft', 'video-moderation', 'pre-publish check'),
      edge('video-moderation', 'video-tags', 'approved draft'),
      edge('video-tags', 'video-publish', 'validated tags'),
      edge('catalog-reference', 'video-tags', 'catalog status', 'dashed'),
      edge('video-publish', 'video-feed', 'published version'),
      edge('video-feed', 'video-commerce', 'discover and click'),
      edge('video-commerce', 'video-evidence', 'order proof', 'dotted'),
      edge(
        'video-publish',
        'video-moderation',
        'post-publish signal',
        'dashed',
      ),
      edge('video-moderation', '2-05-backend-remediation', 'action or appeal'),
      edge('video-moderation', 'video-evidence', 'decision proof', 'dotted'),
      edge(
        '2-05-backend-remediation',
        'video-evidence',
        'appeal proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-06-backend',
    'LIVE scheduling, ingest, active-session commerce, audience interaction, conversion, safe recovery, replay, and moderation evidence.',
    [
      column(
        'Prepare stream',
        node(
          'live-prepare',
          'CN-048 Prepare',
          'Schedule/preflight/ingest extends media infrastructure with creator authorization.',
          'creator',
          'Extend',
        ),
      ),
      column(
        'Open session',
        node(
          'live-metadata',
          'CN-049 Metadata',
          'Metadata snapshots title, schedule, disclosure, host, and moderation policy.',
          'creator',
          'New',
        ),
        node(
          'live-session',
          'Live session',
          'Live session has explicit scheduled, active, reconnecting, ended, and failed states.',
          'system',
          'New',
        ),
      ),
      column(
        'Sell live',
        node(
          'live-products',
          'CN-050 Products',
          'Product pin/tray resolves authoritative price, stock, seller, and affiliate context.',
          'seller',
          'New',
        ),
        node(
          'live-chat',
          'CN-051 Chat / Q&A',
          'Chat/Q&A extends realtime messaging with moderation and session scope.',
          'creator',
          'Extend',
        ),
      ),
      column(
        'Convert & recover',
        node(
          'live-conversion',
          'CN-052 Conversion',
          'Discovery conversion links session, product interaction, touchpoint, and order line.',
          'money',
          'New',
        ),
        node(
          '2-06-backend-remediation',
          'Safe stream recovery',
          'Safe retry handles reconnect or ended stream without duplicate commerce events.',
          'system',
          'Extend',
        ),
      ),
      column(
        'Evidence',
        node(
          'live-recording',
          'Recording / replay',
          'Ended session starts recording processing; a ready recording becomes replay with moderation state.',
          'system',
          'New',
        ),
        node(
          'live-evidence',
          'Moderation evidence',
          'Replay/moderation evidence preserves stream version, chat action, commerce event, and reference.',
          'ops',
          'New',
        ),
      ),
    ],
    [
      edge('live-prepare', 'live-metadata', 'preflight passed'),
      edge('live-metadata', 'live-session', 'open session'),
      edge('live-session', 'live-products', 'session active'),
      edge('live-products', 'live-chat', 'active product context'),
      edge('live-chat', 'live-conversion', 'viewer commerce', 'dashed'),
      edge('live-session', '2-06-backend-remediation', 'disconnect'),
      edge(
        '2-06-backend-remediation',
        'live-session',
        'resume safely',
        'dashed',
      ),
      edge('live-session', 'live-recording', 'session ended', 'dashed'),
      edge('live-conversion', 'live-evidence', 'conversion proof', 'dotted'),
      edge('live-recording', 'live-evidence', 'replay proof', 'dotted'),
      edge(
        '2-06-backend-remediation',
        'live-evidence',
        'recovery proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-07-backend',
    'Seller PPS enrollment, product rate versioning, creator discovery, consent-scoped contact, revocation, expiry, and audit.',
    [
      column(
        'Qualify seller',
        node(
          'pps-terms',
          'CN-053 PPS terms',
          'PPS eligibility/terms bind the seller, funding acceptance, and effective program version.',
          'seller',
          'New',
        ),
      ),
      column(
        'Enroll & configure',
        node(
          'pps-enrollment',
          'Enrollment',
          'Enrollment records accepted terms, actor, effective time, and current status.',
          'seller',
          'New',
        ),
        node(
          'pps-rate',
          'CN-054 Rate',
          'Product/rate version extends the existing catalog without overwriting product truth.',
          'money',
          'Extend',
        ),
      ),
      column(
        'Find creators',
        node(
          'creator-discovery',
          'CN-055 Discovery',
          'Creator discovery/chat uses permission-safe profile data and internal messaging.',
          'seller',
          'Extend',
        ),
      ),
      column(
        'Contact safely',
        node(
          'contact-consent',
          'CN-056 Consent',
          'Contact consent has explicit purpose, scope, grant, expiry, and status.',
          'creator',
          'New',
        ),
        node(
          '2-07-backend-remediation',
          'Safe consent revoke',
          'Safe revoke/expiry hides external contact while preserving authorized chat and audit.',
          'creator',
          'New',
        ),
      ),
      column(
        'Evidence',
        node(
          'pps-evidence',
          'Consent audit',
          'Audit retains terms, rate version, access purpose, consent result, and revocation reference.',
          'system',
          'Existing',
        ),
      ),
    ],
    [
      edge('pps-terms', 'pps-enrollment', 'accept terms'),
      edge('pps-enrollment', 'creator-discovery', 'program active'),
      edge('pps-rate', 'creator-discovery', 'published rate'),
      edge('creator-discovery', 'contact-consent', 'request contact'),
      edge('creator-discovery', '2-07-backend-remediation', 'consent revoked'),
      edge('contact-consent', 'pps-evidence', 'consent proof', 'dotted'),
      edge(
        '2-07-backend-remediation',
        'pps-evidence',
        'revocation proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-08-backend',
    'Versioned collaboration contract, funded fee, sample fulfillment, deliverable acceptance, release, cancellation, dispute, and evidence.',
    [
      column(
        'Start collaboration',
        node(
          'conversation',
          'CN-057 Conversation',
          'Conversation extends internal messaging with collaboration and actor context.',
          'creator',
          'Extend',
        ),
      ),
      column(
        'Contract & fund',
        node(
          'proposal',
          'CN-058 Proposal',
          'Proposal/contract retains immutable revisions, acceptance, deliverables, and rights.',
          'seller',
          'New',
        ),
        node(
          'funded-fee',
          'CN-060 Funded fee',
          'Funded fee records provider reference and release conditions without pooled-balance claims.',
          'money',
          'New',
        ),
      ),
      column(
        'Fulfill sample',
        node(
          'sample',
          'CN-059 Sample',
          'New PPP sample shipment lifecycle reuses shipping/tracking adapters, not commerce fulfillment rows without an ADR.',
          'seller',
          'New',
        ),
      ),
      column(
        'Accept & recover',
        node(
          'deliverable',
          'CN-061 Deliverable',
          'Deliverable/review references the accepted contract version before CN-062 release.',
          'creator',
          'New',
        ),
        node(
          '2-08-backend-remediation',
          'CN-063–065 Recovery',
          'Safe cancellation/dispute keeps contract, funded fee, sample, and review evidence immutable.',
          'ops',
          'New',
        ),
      ),
      column(
        'Evidence',
        node(
          'collaboration-evidence',
          'Release evidence',
          'Release and evidence bind acceptance, amount, ledger reference, actor, and time.',
          'money',
          'Extend',
        ),
      ),
    ],
    [
      edge('conversation', 'proposal', 'negotiate'),
      edge('proposal', 'sample', 'contract accepted'),
      edge('funded-fee', 'sample', 'funding confirmed', 'dashed'),
      edge('sample', 'deliverable', 'delivered'),
      edge('deliverable', 'collaboration-evidence', 'release'),
      edge('sample', '2-08-backend-remediation', 'cancel or dispute'),
      edge('funded-fee', 'collaboration-evidence', 'financial proof', 'dotted'),
      edge(
        '2-08-backend-remediation',
        'collaboration-evidence',
        'dispute proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-09-backend',
    'MCN onboarding, consented membership, effective RBAC, campaign assignment, report, revenue split, settlement, notification, and audit.',
    [
      column(
        'Apply',
        node(
          'mcn-application',
          'CN-066 MCN application',
          'MCN application captures agency identity, authority, terms, and review state.',
          'mcn',
          'New',
        ),
      ),
      column(
        'Build roster',
        node(
          'membership',
          'CN-067 Membership',
          'Roster invitation/membership requires creator acceptance and effective dates.',
          'mcn',
          'New',
        ),
      ),
      column(
        'Authorize work',
        node(
          'mcn-rbac',
          'CN-069 RBAC',
          'RBAC extends existing role primitives with roster and financial scopes.',
          'mcn',
          'Extend',
        ),
        node(
          'mcn-assignment',
          'CN-068 Assignment',
          'Assignment references an active membership, role scope, campaign, and time.',
          'mcn',
          'New',
        ),
      ),
      column(
        'Account & recover',
        node(
          'mcn-revenue',
          'CN-070–071 Revenue',
          'Report and split use an immutable revenue split version per earning line.',
          'money',
          'New',
        ),
        node(
          '2-09-backend-remediation',
          'Safe membership revoke',
          'Safe revoke or appeal updates effective permissions without deleting historical assignment.',
          'ops',
          'Extend',
        ),
      ),
      column(
        'Evidence',
        node(
          'mcn-settlement',
          'CN-072 Settlement',
          'Settlement/notification/audit binds split version, amount, recipient, status, and reference.',
          'money',
          'Extend',
        ),
      ),
    ],
    [
      edge('mcn-application', 'membership', 'approved agency'),
      edge('membership', 'mcn-rbac', 'accepted member'),
      edge('mcn-rbac', 'mcn-assignment', 'authorized scope'),
      edge('mcn-assignment', 'mcn-revenue', 'campaign result', 'dashed'),
      edge('membership', '2-09-backend-remediation', 'leave or revoke'),
      edge('mcn-revenue', 'mcn-settlement', 'settle split', 'dashed'),
      edge('mcn-rbac', 'mcn-settlement', 'access proof', 'dotted'),
      edge(
        '2-09-backend-remediation',
        'mcn-settlement',
        'change proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-10-backend',
    'Approved earning accrual, open-period reconciliation, payee gates, held/payable allocation, immutable statement, provider payout, remediation, and compensating evidence.',
    [
      column(
        'Accrue',
        node(
          'approved-earning',
          'Approved earning',
          'Approved affiliate journal entries enter an open reconciliation period before payee gating.',
          'money',
          'New',
        ),
        node(
          'wallet-period',
          'Open wallet / period',
          'Wallet and open period summarize affiliate subledger balances without transferable stored value.',
          'money',
          'New',
        ),
      ),
      column(
        'Reconcile & gate',
        node(
          'reconciliation',
          'Reconciliation',
          'Order, refund, journal, and provider facts reconcile before the period is locked.',
          'money',
          'Extend',
        ),
        node(
          'payment-gates',
          'CN-077 Payee gates',
          'Identity/tax/payment gates consume masked provider status only after period reconciliation.',
          'money',
          'Extend',
        ),
      ),
      column(
        'Classify allocation',
        node(
          'held-payout',
          'Held',
          'Failed payee, risk, or minimum gate keeps the allocation held with a safe reason.',
          'money',
          'New',
        ),
        node(
          'payable-payout',
          'Payable',
          'A cleared gate creates a funded payable allocation; it does not move money yet.',
          'money',
          'New',
        ),
      ),
      column(
        'State, pay & recover',
        node(
          'statement',
          'CN-073 Statement',
          'Statement snapshots opening, earning, adjustments, withholding, payout allocation, and closing.',
          'money',
          'New',
        ),
        node(
          'provider-payout',
          'Provider payout',
          'Provider payout and reconciliation consume authoritative asynchronous results.',
          'money',
          'Existing',
        ),
        node(
          '2-10-backend-remediation',
          'CN-074–076 Remediate',
          'Safe notify/hold/retry/correct actions use idempotent commands and reason codes.',
          'ops',
          'Extend',
        ),
      ),
      column(
        'Evidence',
        node(
          'payout-evidence',
          'Compensating evidence',
          'Compensating evidence links statement, provider event, reconciliation, and correction entries.',
          'system',
          'Extend',
        ),
      ),
    ],
    [
      edge('approved-earning', 'wallet-period', 'enter open period'),
      edge('wallet-period', 'reconciliation', 'reconcile then lock'),
      edge('reconciliation', 'payment-gates', 'locked period'),
      edge('payment-gates', 'held-payout', 'blocked'),
      edge('payment-gates', 'payable-payout', 'eligible'),
      edge('held-payout', '2-10-backend-remediation', 'safe action'),
      edge('payable-payout', 'statement', 'snapshot allocation'),
      edge('statement', 'provider-payout', 'funded payout'),
      edge('provider-payout', 'payout-evidence', 'provider result', 'dashed'),
      edge('provider-payout', '2-10-backend-remediation', 'failed or reversed'),
      edge('statement', 'payout-evidence', 'statement proof', 'dotted'),
      edge(
        '2-10-backend-remediation',
        'payout-evidence',
        'correction proof',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-11-backend',
    'Observable fraud evidence, risk triage, entity graph, field-validated policy, enforcement, appeal, recall, and preserved proof.',
    [
      column(
        'Report',
        node(
          'fraud-report',
          'CN-080 Report',
          'Report/evidence accepts bounded facts and protects reporter and subject data.',
          'ops',
          'New',
        ),
      ),
      column(
        'Investigate',
        node(
          'risk-triage',
          'Risk triage',
          'Risk triage extends admin case handling with priority, owner, and SLA.',
          'ops',
          'Extend',
        ),
        node(
          'entity-graph',
          'Entity graph',
          'Entity graph exposes authorized relationships and source evidence without raw secrets.',
          'ops',
          'New',
        ),
      ),
      column(
        'Decide',
        node(
          'risk-policy',
          'CN-078–079 Policy',
          'Decision policy requires field validation; no secret threshold or model parity is claimed.',
          'ops',
          'Field-validation gate',
        ),
      ),
      column(
        'Enforce & recover',
        node(
          'enforcement',
          'CN-081 Enforcement',
          'Hold/reverse/enforce actions are scoped, idempotent, confirmed, and reason coded.',
          'ops',
          'New',
        ),
        node(
          '2-11-backend-remediation',
          'Safe enforcement appeal',
          'Safe appeal keeps the original decision effective until an authorized outcome.',
          'creator',
          'New',
        ),
      ),
      column(
        'Evidence',
        node(
          'recall',
          'CN-082 Recall',
          'Recall/takedown and preserved evidence retain policy, actor, scope, time, and reference.',
          'ops',
          'Extend',
        ),
      ),
    ],
    [
      edge('fraud-report', 'risk-triage', 'open case'),
      edge('entity-graph', 'risk-policy', 'authorized facts'),
      edge('risk-triage', 'risk-policy', 'triaged case'),
      edge('risk-policy', 'enforcement', 'approved decision'),
      edge('risk-policy', '2-11-backend-remediation', 'appeal path'),
      edge('risk-policy', 'recall', 'decision proof', 'dotted'),
      edge('enforcement', 'recall', 'action proof', 'dotted'),
      edge('2-11-backend-remediation', 'recall', 'appeal proof', 'dotted'),
    ],
  ),
  spec(
    '2-12-backend',
    'Verified external property, disclosure support, scoped OAuth, catalog feed synchronization, external tagging, reporting, disconnect, and health audit.',
    [
      column(
        'Verify property',
        node(
          'property',
          'CN-083 Property',
          'Property registration/verification records owner, canonical identifier, method, and result.',
          'creator',
          'New',
        ),
        node(
          'disclosure',
          'Disclosure helper',
          'Disclosure helper presents policy guidance without auto-certifying creator content.',
          'creator',
          'New',
        ),
      ),
      column(
        'Authorize channel',
        node(
          'oauth',
          'CN-084 OAuth',
          'OAuth/scopes extend provider authorization with minimum scope and revocation status.',
          'system',
          'Extend',
        ),
      ),
      column(
        'Synchronize & tag',
        node(
          'catalog-sync',
          'YouTube feed / tag',
          'New integration reuses authoritative catalog reads only; feed, eligibility sync, and tag lifecycle are affiliate-owned.',
          'seller',
          'New',
        ),
      ),
      column(
        'Distribute & recover',
        node(
          'channel-report',
          'Channel report',
          'Click/order/earning report preserves external source and authoritative commerce result.',
          'money',
          'New',
        ),
        node(
          '2-12-backend-remediation',
          'Safe disconnect',
          'Safe disconnect/reconnect preserves history and exposes actionable health status.',
          'system',
          'Extend',
        ),
      ),
      column(
        'Evidence',
        node(
          'external-evidence',
          'Channel audit',
          'Audit retains property proof, scope version, sync cursor, tag, report, and disconnect reference.',
          'system',
          'Extend',
        ),
      ),
    ],
    [
      edge('property', 'oauth', 'verified property'),
      edge('disclosure', 'oauth', 'policy acknowledged'),
      edge('oauth', 'catalog-sync', 'authorized scopes'),
      edge(
        'catalog-sync',
        'channel-report',
        'external commerce event',
        'dashed',
      ),
      edge('oauth', '2-12-backend-remediation', 'revoke or expire'),
      edge('channel-report', 'external-evidence', 'report proof', 'dotted'),
      edge(
        '2-12-backend-remediation',
        'external-evidence',
        'disconnect proof',
        'dotted',
      ),
    ],
  ),
] as const satisfies readonly TDiagramSpec[];
