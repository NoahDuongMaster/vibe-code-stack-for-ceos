export type TSurface = 'storefront' | 'vendor' | 'admin';

export type TLayoutRecipe =
  | 'dashboard'
  | 'form'
  | 'list'
  | 'detail'
  | 'composer'
  | 'viewer'
  | 'evidence'
  | 'reconciliation';

export type TScreenState =
  | 'loading'
  | 'empty'
  | 'ready'
  | 'editing'
  | 'submitting'
  | 'success'
  | 'validation-error'
  | 'query-error'
  | 'denied'
  | 'disabled'
  | 'destructive-confirmation'
  | 'stale'
  | 'rate-limited'
  | 'dependency-unavailable'
  | 'offline'
  | 'held'
  | 'failed'
  | 'remediation'
  | 'rejected'
  | 'suspended'
  | 'expired'
  | 'removed'
  | 'reconnecting'
  | 'ended'
  | 'moderation'
  | 'appeal';

export type TScreenComponent = {
  readonly id: string;
  readonly annotationCode: string;
  readonly label: string;
  readonly type: string;
  readonly requirement: string;
  readonly validation: string;
  readonly binding: string;
  readonly states: readonly TScreenState[];
  readonly region: 'header' | 'primary' | 'secondary' | 'aside' | 'footer';
};

type TDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type TNonZeroDigit = Exclude<TDigit, '0'>;

export type TScreenCode =
  | `MH-00${TNonZeroDigit}`
  | `MH-0${'1' | '2' | '3' | '4'}${TDigit}`
  | `MH-05${TDigit}`;

export type TUiPageKey = `3-0${TNonZeroDigit}-ui` | `3-1${'0' | '1' | '2'}-ui`;

export type TScreenContract = {
  readonly code: TScreenCode;
  readonly pageKey: TUiPageKey;
  readonly title: string;
  readonly surface: TSurface;
  readonly actor: string;
  readonly route: string;
  readonly layoutRecipe: TLayoutRecipe;
  readonly primaryAction: string;
  readonly safeExit: string;
  readonly states: readonly TScreenState[];
  readonly components: readonly TScreenComponent[];
};

export type TUiWireframePage = {
  readonly pageKey: TUiPageKey;
  readonly pageId: string;
  readonly pageLabel: string;
  readonly title: string;
  readonly codeRange: string;
  readonly insertBefore: string;
  readonly relatedPageUrl: string;
  readonly screenCodes: readonly TScreenCode[];
  readonly expectedImageTotal: number;
};

export type TScreenVisualTarget = {
  readonly kind: 'wireframe' | 'mockup';
  readonly code: TScreenCode;
  readonly screenCode: TScreenCode;
  readonly screenTitle: string;
  readonly screenSlug: string;
  readonly pageKey: TUiPageKey;
  readonly pageId: string;
  readonly pageLabel: string;
  readonly filename: string;
  readonly alt: string;
  readonly caption: string;
};
