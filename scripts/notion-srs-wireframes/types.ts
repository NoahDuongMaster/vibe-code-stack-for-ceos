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
  | 'pending'
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
  readonly displayTitle: string;
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

export type TVisualFidelity = 'wireframe' | 'high-fidelity';

export type TRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type TLayoutZoneName = 'chrome' | 'primary' | 'states' | 'directory';

export type TLayoutZones = Readonly<Record<TLayoutZoneName, TRect | null>>;

export type TPlaceholderKind =
  | 'generic'
  | 'form'
  | 'table'
  | 'list'
  | 'chart'
  | 'evidence'
  | 'timeline'
  | 'ledger'
  | 'image'
  | 'avatar'
  | 'video';

export type TComponentPlacement = {
  readonly componentId: string;
  readonly annotationCode: string;
  readonly contractIndex: number;
  readonly region: TScreenComponent['region'];
  readonly rect: TRect;
  readonly interactive: boolean;
  readonly visualRole:
    | 'field'
    | 'action'
    | 'content'
    | 'status'
    | 'navigation'
    | 'media'
    | 'evidence';
  readonly placeholderKind: TPlaceholderKind;
};

export type TActionPlacement = {
  readonly id: 'primary-action' | 'safe-exit';
  readonly componentId: string | null;
  readonly ownerId: string;
  readonly label: string;
  readonly displayLabel: string;
  readonly rect: TRect;
  readonly interactive: true;
};

export type TStatePlacement = {
  readonly state: TScreenState;
  readonly displayLabel: string;
  readonly index: number;
  readonly rect: TRect;
};

export type TDirectoryPlacement = {
  readonly componentId: string;
  readonly annotationCode: string;
  readonly type: string;
  readonly requirement: string;
  readonly binding: string;
  readonly column: number;
  readonly row: number;
  readonly rect: TRect;
};

export type TTypographyRole =
  | 'screen-title'
  | 'heading'
  | 'component-label'
  | 'body'
  | 'status'
  | 'annotation';

export type TPanelPrimitive = {
  readonly kind: 'panel';
  readonly id: string;
  readonly ownerId?: string;
  readonly role:
    | 'chrome'
    | 'primary-canvas'
    | 'state-strip'
    | 'annotation-directory';
  readonly rect: TRect;
};

export type TTypographyPrimitive = {
  readonly kind: 'text';
  readonly id: string;
  readonly ownerId: string;
  readonly role: TTypographyRole;
  readonly text: string;
  readonly rect: TRect;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly maxLines: number;
};

export type TPlaceholderPrimitive = {
  readonly kind: 'placeholder';
  readonly id: string;
  readonly ownerId: string;
  readonly placeholderKind: TPlaceholderKind;
  readonly label: string;
  readonly rect: TRect;
};

export type TScenePrimitive =
  | TPanelPrimitive
  | TTypographyPrimitive
  | TPlaceholderPrimitive;

export type TScreenLayout = {
  readonly screenCode: TScreenCode;
  readonly recipe: TLayoutRecipe;
  readonly width: number;
  readonly height: number;
  readonly fidelity: TVisualFidelity;
  readonly zones: TLayoutZones;
  readonly contractComponentIds: readonly string[];
  readonly contractStates: readonly TScreenState[];
  readonly componentPlacements: readonly TComponentPlacement[];
  readonly primaryActionPlacement: TActionPlacement | null;
  readonly safeExitPlacement: TActionPlacement | null;
  readonly statePlacements: readonly TStatePlacement[];
  readonly directoryPlacements: readonly TDirectoryPlacement[];
  readonly scenePrimitives: readonly TScenePrimitive[];
};
