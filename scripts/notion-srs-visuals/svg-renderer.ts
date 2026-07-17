import type { TDiagramSpec, TEdgeStyle, TTone } from './types.ts';

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

type TNodePosition = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const wrap = (value: string, width = 28): string[] => {
  const words = value.split(/\s+/);
  const lines: string[] = [];

  for (const word of words) {
    const last = lines.at(-1);
    if (!last || `${last} ${word}`.length > width) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${last} ${word}`;
    }
  }

  if (lines.length <= 2) {
    return lines;
  }

  return [
    lines[0],
    `${lines
      .slice(1)
      .join(' ')
      .slice(0, width - 1)}…`,
  ];
};

const requirePosition = (
  positions: ReadonlyMap<string, TNodePosition>,
  nodeId: string,
  diagramKey: string,
): TNodePosition => {
  const position = positions.get(nodeId);
  if (!position) {
    throw new Error(`${diagramKey}: missing layout for node ${nodeId}`);
  }
  return position;
};

export const renderDiagram = (spec: TDiagramSpec): string => {
  if (spec.columns.length < 2 || spec.columns.length > 5) {
    throw new Error(`${spec.key}: expected 2–5 columns`);
  }

  const nodeIds = new Set<string>();
  for (const column of spec.columns) {
    if (column.nodes.length === 0 || column.nodes.length > 4) {
      throw new Error(`${spec.key}: every column needs 1–4 nodes`);
    }

    for (const node of column.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error(`${spec.key}: duplicate node ${node.id}`);
      }
      nodeIds.add(node.id);
    }
  }

  for (const edge of spec.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`${spec.key}: unknown edge ${edge.from} → ${edge.to}`);
    }
  }

  const left = 60;
  const right = 1540;
  const gap = 112;
  const columnWidth =
    (right - left - gap * (spec.columns.length - 1)) / spec.columns.length;
  const nodeHeight = 112;
  const positions = new Map<string, TNodePosition>();

  spec.columns.forEach((column, columnIndex) => {
    const x = left + columnIndex * (columnWidth + gap);
    const available = 520 - column.nodes.length * nodeHeight;
    const nodeGap =
      column.nodes.length === 1 ? 0 : available / (column.nodes.length - 1);
    const startY = column.nodes.length === 1 ? 390 : 190;

    column.nodes.forEach((node, nodeIndex) => {
      positions.set(node.id, {
        x,
        y: startY + nodeIndex * (nodeHeight + nodeGap),
        width: columnWidth,
        height: nodeHeight,
      });
    });
  });

  const edgeLayouts = spec.edges.map((edge) => {
    const from = requirePosition(positions, edge.from, spec.key);
    const to = requirePosition(positions, edge.to, spec.key);
    const goesRight = to.x >= from.x;
    const direction = goesRight ? 1 : -1;
    const x1 = goesRight ? from.x + from.width : from.x;
    const y1 = from.y + from.height / 2;
    const x2 = goesRight ? to.x : to.x + to.width;
    const y2 = to.y + to.height / 2;
    const bend = Math.max(28, Math.abs(x2 - x1) / 2);

    return {
      edge,
      x1,
      y1,
      x2,
      y2,
      controlX1: x1 + direction * bend,
      controlX2: x2 - direction * bend,
      labelX: goesRight ? from.x + from.width + gap / 2 : from.x - gap / 2,
      labelY: (y1 + y2) / 2,
    };
  });

  const edgePathSvg = edgeLayouts
    .map((edge) => {
      const dash = DASH[edge.edge.style];
      const dashAttribute = dash ? ` stroke-dasharray="${dash}"` : '';

      return `<path d="M ${edge.x1} ${edge.y1} C ${edge.controlX1} ${edge.y1}, ${edge.controlX2} ${edge.y2}, ${edge.x2} ${edge.y2}" fill="none" stroke="#56616F" stroke-width="3"${dashAttribute} marker-end="url(#arrow)"/>`;
    })
    .join('\n');

  const columnSvg = spec.columns
    .map((column, columnIndex) => {
      const x = left + columnIndex * (columnWidth + gap);
      const heading = `<text x="${x + columnWidth / 2}" y="164" text-anchor="middle" font-size="19" font-weight="700" fill="#26303B">${escapeXml(column.title)}</text>`;
      const nodes = column.nodes
        .map((node) => {
          const position = requirePosition(positions, node.id, spec.key);
          const color = COLORS[node.tone];
          const detailLines = wrap(node.detail);
          const detail = detailLines
            .map(
              (line, index) =>
                `<tspan x="${position.x + 18}" dy="${index === 0 ? 0 : 23}">${escapeXml(line)}</tspan>`,
            )
            .join('');
          const badge = node.badge
            ? `<text x="${position.x + position.width - 14}" y="${position.y + 22}" text-anchor="end" font-size="14" font-weight="700" fill="${color.text}">${escapeXml(node.badge)}</text>`
            : '';

          return `<g><rect x="${position.x}" y="${position.y}" width="${position.width}" height="${position.height}" rx="16" fill="${color.fill}" stroke="${color.stroke}" stroke-width="3"/><text x="${position.x + 18}" y="${position.y + 35}" font-size="22" font-weight="700" fill="${color.text}">${escapeXml(node.label)}</text><text x="${position.x + 18}" y="${position.y + 68}" font-size="18" fill="${color.text}">${detail}</text>${badge}</g>`;
        })
        .join('\n');

      return `${heading}\n${nodes}`;
    })
    .join('\n');

  const edgeLabelSvg = edgeLayouts
    .map(({ edge, labelX, labelY }) => {
      const lines = wrap(edge.label, 11);
      const pillWidth = 96;
      const pillHeight = lines.length === 1 ? 34 : 52;
      const pillX = labelX - pillWidth / 2;
      const pillY = labelY - pillHeight / 2;
      const textY = labelY - (lines.length - 1) * 9 + 5;
      const text = lines
        .map(
          (line, index) =>
            `<tspan x="${labelX}" dy="${index === 0 ? 0 : 18}">${escapeXml(line)}</tspan>`,
        )
        .join('');

      return `<g data-edge-label="true"><title>${escapeXml(edge.label)}</title><rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="10" fill="#FFFFFF" stroke="#697586" stroke-width="2"/><text x="${labelX}" y="${textY}" text-anchor="middle" font-size="15" font-weight="700" fill="#26303B">${text}</text></g>`;
    })
    .join('\n');

  const description = escapeXml(`${spec.subtitle}. ${spec.scope}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-labelledby="diagram-title diagram-desc"><title id="diagram-title">${escapeXml(spec.title)}</title><desc id="diagram-desc">${description}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#56616F"/></marker></defs><rect width="1600" height="900" fill="#FFFFFF"/><text x="60" y="58" font-size="34" font-weight="800" fill="#17202A">${escapeXml(spec.title)}</text><text x="60" y="94" font-size="21" fill="#374151">${escapeXml(spec.subtitle)}</text><text x="60" y="124" font-size="18" fill="#56616F">${escapeXml(spec.scope)}</text>${edgePathSvg}${columnSvg}${edgeLabelSvg}<g transform="translate(60 820)" font-size="16" fill="#26303B"><path d="M 0 12 H 90" stroke="#56616F" stroke-width="3" marker-end="url(#arrow)"/><text x="105" y="18">request / navigation</text><path d="M 345 12 H 435" stroke="#56616F" stroke-width="3" stroke-dasharray="12 8" marker-end="url(#arrow)"/><text x="450" y="18">async / webhook</text><path d="M 680 12 H 770" stroke="#56616F" stroke-width="3" stroke-dasharray="3 8" marker-end="url(#arrow)"/><text x="785" y="18">audit / evidence</text><text x="1120" y="18" font-weight="700">Visual aid — normative SRS text is authoritative</text></g></svg>`;
};
