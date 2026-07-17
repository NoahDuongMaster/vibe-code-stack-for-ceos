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
