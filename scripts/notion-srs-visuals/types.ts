export type TDiagramKind = 'overview' | 'backend' | 'ui' | 'test';
export type TVersion = '0.2' | '0.4' | '0.5';
export type TTone = 'creator' | 'seller' | 'mcn' | 'ops' | 'money' | 'system';
export type TBadge = 'Hiện có' | 'Mở rộng' | 'Mới' | 'Cổng xác thực thực địa';
export type TEdgeStyle = 'solid' | 'dashed' | 'dotted';

export type TLegacyVisualCopy = Readonly<{
  title: string;
  alt: string;
  caption: string;
}>;

export type TDiagramTarget = Readonly<{
  key: string;
  filename: string;
  kind: TDiagramKind;
  pageId: string;
  pageLabel: string;
  title: string;
  codeRange: string;
  previousVersion: Exclude<TVersion, '0.5'>;
  nextVersion: '0.5';
  currentVersion: '0.5';
  insertBefore: string;
  alt: string;
  caption: string;
  legacy: TLegacyVisualCopy;
  relatedPageUrl?: string;
}>;

export type TDiagramNode = Readonly<{
  id: string;
  label: string;
  detail: string;
  tone: TTone;
  badge?: TBadge;
}>;

export type TDiagramColumn = Readonly<{
  title: string;
  nodes: readonly TDiagramNode[];
  allowVisualReorder?: true;
}>;

export type TDiagramEdge = Readonly<{
  from: string;
  to: string;
  label: string;
  style: TEdgeStyle;
}>;

export type TDiagramSpec = Readonly<{
  key: string;
  title: string;
  subtitle: string;
  scope: string;
  columns: readonly TDiagramColumn[];
  edges: readonly TDiagramEdge[];
}>;

export type TRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type TPoint = Readonly<{ x: number; y: number }>;

export type TSegment = Readonly<{ from: TPoint; to: TPoint }>;

export type TLayoutText = Readonly<{
  rect: TRect;
  lines: readonly string[];
  fontSize: number;
  lineHeight: number;
  align: 'start' | 'middle' | 'end';
}>;

export type TReferenceKind =
  | 'handoff'
  | 'jump'
  | 'return'
  | 'evidence'
  | 'async'
  | 'same-column-reference';

export type TLayoutPath = Readonly<{
  edge: TDiagramEdge;
  code: string;
  kind: 'forward-lane' | 'same-column-rail';
  lane: string;
  segments: readonly TSegment[];
  label: TLayoutText;
}>;

export type TLayoutReference = Readonly<{
  edge: TDiagramEdge;
  kind: TReferenceKind;
  code: string;
  endpoints: readonly [
    Readonly<{
      role: 'source';
      nodeId: string;
      chipRect: TRect;
      label: TLayoutText;
    }>,
    Readonly<{
      role: 'target';
      nodeId: string;
      chipRect: TRect;
      label: TLayoutText;
    }>,
  ];
}>;

export type TDiagramLayout = Readonly<{
  key: string;
  viewBox: Readonly<{ width: 1400; height: 1800 }>;
  typography: Readonly<{
    title: 46;
    subtitle: 30;
    scope: 24;
    band: 30;
    column: 26;
    nodeTitle: 30;
    nodeDetail: 24;
    badge: 20;
    connector: 22;
    footer: 22;
  }>;
  header: Readonly<{
    title: TLayoutText;
    subtitle: TLayoutText;
    scope: TLayoutText;
  }>;
  bands: readonly Readonly<{
    index: 0 | 1;
    columnIndexes: readonly number[];
    rect: TRect;
  }>[];
  columns: readonly Readonly<{
    index: number;
    bandIndex: 0 | 1;
    rect: TRect;
    title: TLayoutText;
  }>[];
  nodes: readonly Readonly<{
    node: TDiagramNode;
    bandIndex: 0 | 1;
    columnIndex: number;
    rect: TRect;
    title: TLayoutText;
    detail: TLayoutText;
    badge?: Readonly<{ rect: TRect; text: string }>;
  }>[];
  paths: readonly TLayoutPath[];
  references: readonly TLayoutReference[];
  footer: Readonly<{
    legendItems: readonly TLayoutText[];
    edgeItems: readonly Readonly<{
      code: string;
      edge: TDiagramEdge;
      text: TLayoutText;
    }>[];
    warning: TLayoutText;
  }>;
}>;
