import { TARGET_BY_KEY } from './manifest.ts';

import type { TDiagramSpec } from './types.ts';

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

export const OVERVIEW_AND_TEST_SPECS = [
  {
    ...metadata(
      'page-1-system-context',
      'Actors, product surfaces, affiliate domains, external boundaries, and evidence controls.',
    ),
    columns: [
      {
        title: 'Actors',
        nodes: [
          {
            id: 'context-creator',
            label: 'Creator',
            detail: 'Creates affiliate assets and reviews attributed earnings.',
            tone: 'creator',
          },
          {
            id: 'context-seller',
            label: 'Seller',
            detail: 'Publishes offers, rates, and collaboration terms.',
            tone: 'seller',
          },
          {
            id: 'context-mcn',
            label: 'MCN',
            detail: 'Manages consented rosters, roles, and revenue splits.',
            tone: 'mcn',
          },
          {
            id: 'context-buyer',
            label: 'Buyer',
            detail: 'Discovers content and completes an eligible order.',
            tone: 'system',
          },
        ],
      },
      {
        title: 'Ops & surfaces',
        nodes: [
          {
            id: 'context-ops',
            label: 'Ops',
            detail: 'Reviews identity, risk, finance, and appeal cases.',
            tone: 'ops',
          },
          {
            id: 'context-storefront',
            label: 'Storefront',
            detail: 'Creator and buyer discovery, account, and reporting UI.',
            tone: 'creator',
            badge: 'Existing',
          },
          {
            id: 'context-vendor',
            label: 'Vendor Portal',
            detail: 'Seller and MCN configuration and collaboration UI.',
            tone: 'seller',
            badge: 'Extend',
          },
          {
            id: 'context-admin',
            label: 'Medusa Admin',
            detail: 'Operations review, risk, reconciliation, and evidence UI.',
            tone: 'ops',
            badge: 'Extend',
          },
        ],
      },
      {
        title: 'Benadep domains',
        nodes: [
          {
            id: 'context-identity',
            label: 'Affiliate Identity',
            detail: 'Application, eligibility, ownership, and account state.',
            tone: 'creator',
            badge: 'New',
          },
          {
            id: 'context-assets',
            label: 'Assets / Content',
            detail:
              'Tracked links, codes, collections, Video, and LIVE assets.',
            tone: 'creator',
            badge: 'New',
          },
          {
            id: 'context-attribution',
            label: 'Attribution',
            detail: 'Versioned candidates and winner with replayable evidence.',
            tone: 'system',
            badge: 'Field-validation gate',
          },
          {
            id: 'context-ledger',
            label: 'Ledger / Payout',
            detail:
              'Order-line commission journal, reconciliation, and payout.',
            tone: 'money',
            badge: 'New',
          },
        ],
      },
      {
        title: 'External boundaries',
        nodes: [
          {
            id: 'context-external',
            label: 'External Channel',
            detail: 'Consent-scoped distribution and commerce integrations.',
            tone: 'system',
            badge: 'New',
          },
          {
            id: 'context-payment',
            label: 'Tax / Payment Provider',
            detail: 'Verified tax and payment setup plus payout result.',
            tone: 'money',
            badge: 'Extend',
          },
          {
            id: 'context-youtube',
            label: 'YouTube / OAuth',
            detail: 'Authorized scopes, feed synchronization, and disconnect.',
            tone: 'system',
            badge: 'New',
          },
          {
            id: 'context-notification',
            label: 'Notification',
            detail: 'Asynchronous status and remediation messages.',
            tone: 'system',
            badge: 'Extend',
          },
        ],
      },
      {
        title: 'Evidence',
        nodes: [
          {
            id: 'context-policy',
            label: 'Versioned policy',
            detail: 'Effective rules and terms retained with each decision.',
            tone: 'system',
          },
          {
            id: 'context-audit',
            label: 'Audit log',
            detail:
              'Actor, input, result, timestamp, and correlation reference.',
            tone: 'system',
          },
          {
            id: 'context-appeal',
            label: 'Appeal / Support',
            detail: 'Safe remediation path with preserved case evidence.',
            tone: 'ops',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'context-creator',
        to: 'context-storefront',
        label: 'create and review',
        style: 'solid',
      },
      {
        from: 'context-seller',
        to: 'context-vendor',
        label: 'configure',
        style: 'solid',
      },
      {
        from: 'context-mcn',
        to: 'context-vendor',
        label: 'manage roster',
        style: 'solid',
      },
      {
        from: 'context-buyer',
        to: 'context-storefront',
        label: 'discover and order',
        style: 'solid',
      },
      {
        from: 'context-ops',
        to: 'context-admin',
        label: 'review and remediate',
        style: 'solid',
      },
      {
        from: 'context-creator',
        to: 'context-external',
        label: 'authorize distribution',
        style: 'solid',
      },
      {
        from: 'context-storefront',
        to: 'context-identity',
        label: 'account command',
        style: 'solid',
      },
      {
        from: 'context-vendor',
        to: 'context-assets',
        label: 'offer and content command',
        style: 'solid',
      },
      {
        from: 'context-admin',
        to: 'context-attribution',
        label: 'authorized review',
        style: 'solid',
      },
      {
        from: 'context-admin',
        to: 'context-ledger',
        label: 'finance operation',
        style: 'solid',
      },
      {
        from: 'context-external',
        to: 'context-assets',
        label: 'channel asset',
        style: 'solid',
      },
      {
        from: 'context-assets',
        to: 'context-attribution',
        label: 'touchpoint event',
        style: 'dashed',
      },
      {
        from: 'context-attribution',
        to: 'context-ledger',
        label: 'order-line result',
        style: 'dashed',
      },
      {
        from: 'context-ledger',
        to: 'context-payment',
        label: 'payout request and result',
        style: 'dashed',
      },
      {
        from: 'context-assets',
        to: 'context-youtube',
        label: 'OAuth and feed sync',
        style: 'dashed',
      },
      {
        from: 'context-identity',
        to: 'context-notification',
        label: 'status event',
        style: 'dashed',
      },
      {
        from: 'context-identity',
        to: 'context-policy',
        label: 'policy version',
        style: 'dotted',
      },
      {
        from: 'context-assets',
        to: 'context-audit',
        label: 'asset version evidence',
        style: 'dotted',
      },
      {
        from: 'context-attribution',
        to: 'context-audit',
        label: 'decision evidence',
        style: 'dotted',
      },
      {
        from: 'context-attribution',
        to: 'context-appeal',
        label: 'dispute reference',
        style: 'dotted',
      },
      {
        from: 'context-ledger',
        to: 'context-audit',
        label: 'journal evidence',
        style: 'dotted',
      },
      {
        from: 'context-ledger',
        to: 'context-appeal',
        label: 'financial remediation',
        style: 'dotted',
      },
      {
        from: 'context-payment',
        to: 'context-audit',
        label: 'provider result evidence',
        style: 'dotted',
      },
    ],
  },
  {
    ...metadata(
      'page-1-end-to-end',
      'Affiliate asset, observable touchpoint, attribution, order-line commission, settlement, and evidence controls.',
    ),
    columns: [
      {
        title: 'Create & Observe',
        nodes: [
          {
            id: 'e2e-asset',
            label: 'Affiliate asset / content',
            detail:
              'Versioned tracked link, code, collection, Video, or LIVE asset.',
            tone: 'creator',
            badge: 'New',
          },
          {
            id: 'e2e-touchpoint',
            label: 'Click / touchpoint',
            detail:
              'Timestamped source context and eligible commerce evidence.',
            tone: 'system',
            badge: 'New',
          },
        ],
      },
      {
        title: 'Decide',
        nodes: [
          {
            id: 'e2e-candidates',
            label: 'Candidate set',
            detail: 'Eligible touchpoints within the versioned policy window.',
            tone: 'system',
            badge: 'Field-validation gate',
          },
          {
            id: 'e2e-winner',
            label: 'Attribution winner',
            detail:
              'Replayable winner and policy version, without secret-algorithm claims.',
            tone: 'system',
            badge: 'Field-validation gate',
          },
        ],
      },
      {
        title: 'Earn',
        nodes: [
          {
            id: 'e2e-rate',
            label: 'Order-line rate snapshot',
            detail:
              'Immutable eligible amount, rate, currency, and rule version.',
            tone: 'money',
            badge: 'New',
          },
          {
            id: 'e2e-estimated',
            label: 'estimated',
            detail: 'Provisional commission after attribution.',
            tone: 'money',
          },
          {
            id: 'e2e-approved',
            label: 'approved',
            detail: 'Commission accepted after order and policy checks.',
            tone: 'money',
          },
          {
            id: 'e2e-payable',
            label: 'payable',
            detail: 'Approved commission eligible for a payout period.',
            tone: 'money',
          },
        ],
      },
      {
        title: 'Settle',
        nodes: [
          {
            id: 'e2e-ledger',
            label: 'Ledger / reconciliation',
            detail:
              'Append-only journal matched to provider and order evidence.',
            tone: 'money',
            badge: 'New',
          },
          {
            id: 'e2e-paid',
            label: 'paid',
            detail: 'Provider-confirmed settlement with a reference.',
            tone: 'money',
          },
        ],
      },
      {
        title: 'Control',
        nodes: [
          {
            id: 'e2e-held',
            label: 'held',
            detail: 'Payout blocked with a safe reason and remediation path.',
            tone: 'ops',
          },
          {
            id: 'e2e-reversed',
            label: 'reversed',
            detail:
              'Compensating journal entry; prior evidence remains intact.',
            tone: 'ops',
          },
          {
            id: 'e2e-evidence',
            label: 'Dispute / appeal + evidence',
            detail:
              'Versioned inputs, decisions, journal entries, and case reference.',
            tone: 'ops',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'e2e-asset',
        to: 'e2e-touchpoint',
        label: 'publish and navigate',
        style: 'solid',
      },
      {
        from: 'e2e-touchpoint',
        to: 'e2e-candidates',
        label: 'touchpoint event',
        style: 'dashed',
      },
      {
        from: 'e2e-candidates',
        to: 'e2e-winner',
        label: 'versioned decision',
        style: 'solid',
      },
      {
        from: 'e2e-winner',
        to: 'e2e-rate',
        label: 'eligible order line',
        style: 'solid',
      },
      {
        from: 'e2e-rate',
        to: 'e2e-estimated',
        label: 'calculate',
        style: 'solid',
      },
      {
        from: 'e2e-estimated',
        to: 'e2e-approved',
        label: 'approve',
        style: 'solid',
      },
      {
        from: 'e2e-approved',
        to: 'e2e-payable',
        label: 'mature',
        style: 'solid',
      },
      {
        from: 'e2e-payable',
        to: 'e2e-ledger',
        label: 'close period',
        style: 'solid',
      },
      {
        from: 'e2e-ledger',
        to: 'e2e-paid',
        label: 'provider settlement',
        style: 'dashed',
      },
      {
        from: 'e2e-approved',
        to: 'e2e-held',
        label: 'risk, tax, or payment gate',
        style: 'solid',
      },
      {
        from: 'e2e-paid',
        to: 'e2e-reversed',
        label: 'compensating correction',
        style: 'solid',
      },
      {
        from: 'e2e-winner',
        to: 'e2e-evidence',
        label: 'decision evidence',
        style: 'dotted',
      },
      {
        from: 'e2e-candidates',
        to: 'e2e-evidence',
        label: 'candidate-set evidence',
        style: 'dotted',
      },
      {
        from: 'e2e-rate',
        to: 'e2e-evidence',
        label: 'rate evidence',
        style: 'dotted',
      },
      {
        from: 'e2e-estimated',
        to: 'e2e-evidence',
        label: 'journal evidence',
        style: 'dotted',
      },
      {
        from: 'e2e-approved',
        to: 'e2e-evidence',
        label: 'approval evidence',
        style: 'dotted',
      },
      {
        from: 'e2e-payable',
        to: 'e2e-evidence',
        label: 'period evidence',
        style: 'dotted',
      },
      {
        from: 'e2e-ledger',
        to: 'e2e-evidence',
        label: 'reconciliation evidence',
        style: 'dotted',
      },
      {
        from: 'e2e-paid',
        to: 'e2e-evidence',
        label: 'provider reference',
        style: 'dotted',
      },
      {
        from: 'e2e-held',
        to: 'e2e-evidence',
        label: 'hold and appeal reference',
        style: 'dotted',
      },
      {
        from: 'e2e-reversed',
        to: 'e2e-evidence',
        label: 'reversal evidence',
        style: 'dotted',
      },
    ],
  },
  {
    ...metadata(
      'page-4-traceability',
      'Observable outcome through requirement, surface, test, and retained proof.',
    ),
    columns: [
      {
        title: 'Observation & baseline',
        nodes: [
          {
            id: 'trace-observation',
            label: 'Shopee observable outcome',
            detail:
              'Externally observable behavior; no secret-internal equivalence claim.',
            tone: 'system',
          },
          {
            id: 'trace-sp',
            label: 'SP',
            detail: 'Observed parity statement and source reference.',
            tone: 'system',
          },
        ],
      },
      {
        title: 'Product & rules',
        nodes: [
          {
            id: 'trace-cn',
            label: 'CN',
            detail: 'Normative functional capability requirement.',
            tone: 'creator',
          },
          {
            id: 'trace-qt',
            label: 'QT',
            detail: 'Business rule, invariant, and safe outcome.',
            tone: 'seller',
          },
        ],
      },
      {
        title: 'Surface & test',
        nodes: [
          {
            id: 'trace-mh',
            label: 'MH / non-UI',
            detail: 'User-facing screen contract or explicit non-UI boundary.',
            tone: 'mcn',
          },
          {
            id: 'trace-kt',
            label: 'KT',
            detail: 'Acceptance scenario with an observable expected outcome.',
            tone: 'ops',
          },
        ],
      },
      {
        title: 'Proof & gate',
        nodes: [
          {
            id: 'trace-evidence',
            label: 'Automated / manual evidence',
            detail:
              'Test, capture, log, build, and authenticated field evidence.',
            tone: 'system',
          },
          {
            id: 'trace-field-validation',
            label: 'Field-validation gate',
            detail:
              'Required for secret or otherwise unobservable internal behavior.',
            tone: 'ops',
            badge: 'Field-validation gate',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'trace-observation',
        to: 'trace-sp',
        label: 'record',
        style: 'solid',
      },
      {
        from: 'trace-sp',
        to: 'trace-cn',
        label: 'specify outcome',
        style: 'solid',
      },
      {
        from: 'trace-cn',
        to: 'trace-qt',
        label: 'constrain',
        style: 'solid',
      },
      {
        from: 'trace-qt',
        to: 'trace-mh',
        label: 'expose behavior',
        style: 'solid',
      },
      {
        from: 'trace-mh',
        to: 'trace-kt',
        label: 'acceptance coverage',
        style: 'solid',
      },
      {
        from: 'trace-kt',
        to: 'trace-evidence',
        label: 'retain proof',
        style: 'dotted',
      },
      {
        from: 'trace-observation',
        to: 'trace-field-validation',
        label: 'unobservable internal claim',
        style: 'dotted',
      },
      {
        from: 'trace-field-validation',
        to: 'trace-evidence',
        label: 'validated field evidence',
        style: 'dotted',
      },
    ],
  },
  {
    ...metadata(
      'page-4-release-gate',
      'Required test suites, cross-cutting controls, source evidence, approval, and release decision.',
    ),
    columns: [
      {
        title: 'Suites',
        nodes: [
          {
            id: 'release-capability',
            label: 'Capability',
            detail: 'CN, QT, and MH or non-UI acceptance coverage.',
            tone: 'creator',
          },
          {
            id: 'release-golden',
            label: 'Golden E2E',
            detail: 'Critical actor journeys and state transitions.',
            tone: 'creator',
          },
          {
            id: 'release-algorithm',
            label: 'Algorithm validation',
            detail:
              'Approved data set and field-validation evidence where required.',
            tone: 'system',
            badge: 'Field-validation gate',
          },
        ],
      },
      {
        title: 'Cross-cutting',
        nodes: [
          {
            id: 'release-security',
            label: 'Security',
            detail: 'Authorization, privacy, abuse, and safe error handling.',
            tone: 'ops',
          },
          {
            id: 'release-wcag',
            label: 'WCAG 2.2 AA',
            detail:
              'Keyboard, semantics, labels, contrast, and responsive behavior.',
            tone: 'system',
          },
          {
            id: 'release-finance',
            label: 'Finance reconciliation',
            detail: 'Order-line journal and provider totals reconcile.',
            tone: 'money',
          },
        ],
      },
      {
        title: 'Source evidence',
        nodes: [
          {
            id: 'release-code',
            label: 'Code / test / build',
            detail: 'Repository gates and reproducible artifacts pass.',
            tone: 'system',
          },
          {
            id: 'release-authenticated',
            label: 'Authenticated evidence',
            detail: 'Authorized field capture with scope and timestamp.',
            tone: 'system',
          },
        ],
      },
      {
        title: 'Approval',
        nodes: [
          {
            id: 'release-approval',
            label: 'Product / Engineering / Legal / Finance / QA',
            detail: 'Required owners approve their applicable evidence gates.',
            tone: 'ops',
          },
        ],
      },
      {
        title: 'Decision',
        nodes: [
          {
            id: 'release-decision',
            label: 'Release only when all required gates pass',
            detail: 'Any failed or missing required gate blocks release.',
            tone: 'ops',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'release-capability',
        to: 'release-code',
        label: 'test evidence',
        style: 'dotted',
      },
      {
        from: 'release-golden',
        to: 'release-code',
        label: 'E2E evidence',
        style: 'dotted',
      },
      {
        from: 'release-algorithm',
        to: 'release-authenticated',
        label: 'validation evidence',
        style: 'dotted',
      },
      {
        from: 'release-security',
        to: 'release-code',
        label: 'security evidence',
        style: 'dotted',
      },
      {
        from: 'release-wcag',
        to: 'release-code',
        label: 'accessibility evidence',
        style: 'dotted',
      },
      {
        from: 'release-finance',
        to: 'release-authenticated',
        label: 'reconciliation evidence',
        style: 'dotted',
      },
      {
        from: 'release-code',
        to: 'release-approval',
        label: 'submit source proof',
        style: 'solid',
      },
      {
        from: 'release-authenticated',
        to: 'release-approval',
        label: 'submit field proof',
        style: 'solid',
      },
      {
        from: 'release-approval',
        to: 'release-decision',
        label: 'all required approvals',
        style: 'solid',
      },
      {
        from: 'release-approval',
        to: 'release-authenticated',
        label: 'approval evidence',
        style: 'dotted',
      },
      {
        from: 'release-decision',
        to: 'release-authenticated',
        label: 'decision evidence',
        style: 'dotted',
      },
    ],
  },
] as const satisfies readonly TDiagramSpec[];
