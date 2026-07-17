import { layoutDiagram } from './diagram-layout.ts';
import { auditDiagramGeometry } from './geometry-audit.ts';

import type {
  TDiagramLayout,
  TDiagramSpec,
  TEdgeStyle,
  TLayoutText,
  TRect,
  TTone,
} from './types.ts';

const COLORS: Record<TTone, { fill: string; stroke: string; text: string }> = {
  creator: { fill: '#EAF2FF', stroke: '#2457A7', text: '#173A70' },
  seller: { fill: '#FFF0E5', stroke: '#B94F00', text: '#743200' },
  mcn: { fill: '#F3EAFF', stroke: '#7042A1', text: '#472768' },
  ops: { fill: '#FFECEC', stroke: '#B42318', text: '#7A1A14' },
  money: { fill: '#EAF8EF', stroke: '#287A45', text: '#18512D' },
  system: { fill: '#F1F3F5', stroke: '#4B5563', text: '#26303B' },
};

const DASH: Record<TEdgeStyle, string | undefined> = {
  solid: undefined,
  dashed: '12 8',
  dotted: '3 8',
};

type TTextOptions = Readonly<{
  fill?: string;
  fontWeight?: number;
}>;

export const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const numberValue = (value: number): string => String(value);

const rectAttributes = (rect: TRect): string =>
  `x="${numberValue(rect.x)}" y="${numberValue(rect.y)}" width="${numberValue(rect.width)}" height="${numberValue(rect.height)}"`;

const textAnchor = (align: TLayoutText['align']): string =>
  align === 'middle' ? 'middle' : align === 'end' ? 'end' : 'start';

const textX = (text: TLayoutText): number =>
  text.align === 'middle'
    ? text.rect.x + text.rect.width / 2
    : text.align === 'end'
      ? text.rect.x + text.rect.width
      : text.rect.x;

const renderText = (
  text: TLayoutText,
  { fill = '#26303B', fontWeight }: TTextOptions = {},
): string => {
  const x = numberValue(textX(text));
  const y = numberValue(text.rect.y + text.fontSize);
  const weight = fontWeight ? ` font-weight="${fontWeight}"` : '';
  const attributes = `x="${x}" y="${y}" text-anchor="${textAnchor(text.align)}" font-size="${text.fontSize}"${weight} fill="${fill}"`;

  if (text.lines.length === 1) {
    return `<text ${attributes}>${escapeXml(text.lines[0] ?? '')}</text>`;
  }

  const lines = text.lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : text.lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<text ${attributes}>${lines}</text>`;
};

const renderPathData = (
  segments: TDiagramLayout['paths'][number]['segments'],
): string => {
  const first = segments[0];
  if (!first) {
    throw new Error('cannot render an edge without path segments');
  }

  const commands = [
    `M ${numberValue(first.from.x)} ${numberValue(first.from.y)}`,
  ];
  for (const segment of segments) {
    if (segment.from.x === segment.to.x) {
      commands.push(`V ${numberValue(segment.to.y)}`);
    } else if (segment.from.y === segment.to.y) {
      commands.push(`H ${numberValue(segment.to.x)}`);
    } else {
      commands.push(
        `L ${numberValue(segment.to.x)} ${numberValue(segment.to.y)}`,
      );
    }
  }
  return commands.join(' ');
};

const renderBands = (layout: TDiagramLayout): string =>
  layout.bands
    .map(
      (band) =>
        `<g data-band-index="${band.index}"><rect ${rectAttributes(band.rect)} rx="20" fill="${band.index === 0 ? '#F8FAFC' : '#F7F9FC'}" stroke="#CBD5E1" stroke-width="2"/></g>`,
    )
    .join('\n');

const renderColumns = (layout: TDiagramLayout): string =>
  layout.columns
    .map(
      (column) =>
        `<g data-column-index="${column.index}" data-column-band="${column.bandIndex}">${renderText(column.title, { fontWeight: 700 })}</g>`,
    )
    .join('\n');

const renderPaths = (layout: TDiagramLayout): string =>
  layout.paths
    .map((path) => {
      const dash = DASH[path.edge.style];
      const dashAttribute = dash ? ` stroke-dasharray="${dash}"` : '';
      return `<path data-edge-from="${escapeXml(path.edge.from)}" data-edge-to="${escapeXml(path.edge.to)}" data-path-kind="${path.kind}" data-edge-code="${escapeXml(path.code)}" data-lane="${escapeXml(path.lane)}" d="${renderPathData(path.segments)}" fill="none" stroke="#56616F" stroke-width="3"${dashAttribute} marker-end="url(#arrow)"/>`;
    })
    .join('\n');

const renderNodes = (layout: TDiagramLayout): string =>
  layout.nodes
    .map((node) => {
      const color = COLORS[node.node.tone];
      const badge = node.badge
        ? `<g data-node-badge="${escapeXml(node.node.id)}"><rect ${rectAttributes(node.badge.rect)} rx="14" fill="#FFFFFF" stroke="${color.stroke}" stroke-width="2"/><text x="${numberValue(node.badge.rect.x + node.badge.rect.width / 2)}" y="${numberValue(node.badge.rect.y + layout.typography.badge)}" text-anchor="middle" font-size="${layout.typography.badge}" font-weight="700" fill="${color.text}">${escapeXml(node.badge.text)}</text></g>`
        : '';
      return `<g data-node-id="${escapeXml(node.node.id)}" data-node-band="${node.bandIndex}" data-column-index="${node.columnIndex}"><rect ${rectAttributes(node.rect)} rx="16" fill="${color.fill}" stroke="${color.stroke}" stroke-width="3"/>${renderText(node.title, { fill: color.text, fontWeight: 700 })}${renderText(node.detail, { fill: color.text })}${badge}</g>`;
    })
    .join('\n');

const renderPathMarkers = (layout: TDiagramLayout): string =>
  layout.paths
    .map(
      (path) =>
        `<g data-path-marker="true" data-edge-code="${escapeXml(path.code)}" data-edge-from="${escapeXml(path.edge.from)}" data-edge-to="${escapeXml(path.edge.to)}"><title>${escapeXml(path.edge.label)}</title><rect ${rectAttributes(path.label.rect)} rx="8" fill="#FFFFFF" stroke="#56616F" stroke-width="2"/>${renderText(path.label, { fontWeight: 700 })}</g>`,
    )
    .join('\n');

const renderReferences = (layout: TDiagramLayout): string =>
  layout.references
    .flatMap((reference) =>
      reference.endpoints.map(
        (endpoint) =>
          `<g data-reference-kind="${reference.kind}" data-reference-code="${escapeXml(reference.code)}" data-reference-role="${endpoint.role}" data-reference-node-id="${escapeXml(endpoint.nodeId)}"><title>${escapeXml(reference.edge.label)}</title><rect ${rectAttributes(endpoint.chipRect)} rx="8" fill="#FFFFFF" stroke="#56616F" stroke-width="2"/>${renderText(endpoint.label, { fontWeight: 700 })}</g>`,
      ),
    )
    .join('\n');

const renderFooter = (layout: TDiagramLayout): string => {
  const legend = layout.footer.legendItems
    .map((item) => renderText(item, { fontWeight: 700 }))
    .join('\n');
  const directory = layout.footer.edgeItems
    .map(
      (item) =>
        `<g data-edge-directory-code="${escapeXml(item.code)}" data-edge-from="${escapeXml(item.edge.from)}" data-edge-to="${escapeXml(item.edge.to)}">${renderText(item.text)}</g>`,
    )
    .join('\n');

  return `<g data-footer="true">${legend}${directory}${renderText(layout.footer.warning, { fontWeight: 700 })}</g>`;
};

export const renderDiagram = (spec: TDiagramSpec): string => {
  const layout = layoutDiagram(spec);
  const geometryErrors = auditDiagramGeometry(layout);
  if (geometryErrors.length > 0) {
    throw new Error(
      `${spec.key}: geometry audit failed\n${geometryErrors.join('\n')}`,
    );
  }

  const nodeDescription = spec.columns
    .flatMap((column) => column.nodes)
    .map(
      (node) =>
        `${node.label}: ${node.detail}${node.badge ? `; trạng thái ${node.badge}` : ''}`,
    )
    .join('; ');
  const edgeDescription = layout.footer.edgeItems
    .map((item) => `${item.code}: ${item.edge.label}`)
    .join('; ');
  const description = escapeXml(
    `${spec.subtitle}. ${spec.scope}. Các nút: ${nodeDescription}. Các quan hệ: ${edgeDescription}.`,
  );
  const { width, height } = layout.viewBox;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="diagram-title diagram-desc"><title id="diagram-title">${escapeXml(spec.title)}</title><desc id="diagram-desc">${description}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#56616F"/></marker></defs><rect width="${width}" height="${height}" fill="#FFFFFF"/>${renderText(layout.header.title, { fontWeight: 800 })}${renderText(layout.header.subtitle)}${renderText(layout.header.scope, { fill: '#56616F' })}${renderBands(layout)}${renderColumns(layout)}${renderPaths(layout)}${renderNodes(layout)}${renderPathMarkers(layout)}${renderReferences(layout)}${renderFooter(layout)}</svg>`;
};
