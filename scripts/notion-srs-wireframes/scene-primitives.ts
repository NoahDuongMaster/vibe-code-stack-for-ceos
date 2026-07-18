import type { TPlaceholderKind, TRect } from './types.ts';

export const WIREFRAME_PALETTE = Object.freeze({
  page: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F1F3',
  border: '#AEB1B7',
  borderStrong: '#62666D',
  ink: '#25272B',
  inkMuted: '#62666D',
  dustyRose: '#F67993',
  dustyRoseMuted: '#FFF0F3',
});

type TTextOptions = Readonly<{
  x: number;
  y: number;
  lines: readonly string[];
  fontSize: number;
  lineHeight: number;
  weight?: 400 | 500 | 600 | 700;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  id?: string;
  primitive?: string;
}>;

type TLabeledRectOptions = Readonly<{
  rect: TRect;
  label: string;
}>;

type TButtonTone = 'primary' | 'secondary' | 'destructive';
type TMediaKind = 'image' | 'avatar' | 'video' | 'live';

const SAFE_SVG_COLOR = /^#[0-9A-F]{6}$/iu;
const SAFE_FONT_WEIGHTS = new Set([400, 500, 600, 700]);
const SAFE_TEXT_ANCHORS = new Set(['start', 'middle', 'end']);

export const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const numberAttribute = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new Error('SVG coordinates must be finite');
  }
  return String(Object.is(value, -0) ? 0 : Math.round(value * 1000) / 1000);
};

const assertRect = (rect: TRect): void => {
  for (const value of [rect.x, rect.y, rect.width, rect.height]) {
    if (!Number.isFinite(value)) {
      throw new Error('SVG rectangle coordinates must be finite');
    }
  }
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error('SVG rectangles must have positive dimensions');
  }
};

const rectAttributes = (rect: TRect): string => {
  assertRect(rect);
  return `x="${numberAttribute(rect.x)}" y="${numberAttribute(rect.y)}" width="${numberAttribute(rect.width)}" height="${numberAttribute(rect.height)}"`;
};

const insetRect = (rect: TRect, inset: number): TRect => {
  const maximumInset = Math.max(0, Math.min(rect.width, rect.height) / 2 - 1);
  const safeInset = Math.min(inset, maximumInset);
  return {
    x: rect.x + safeInset,
    y: rect.y + safeInset,
    width: rect.width - safeInset * 2,
    height: rect.height - safeInset * 2,
  };
};

const horizontalLine = (
  x1: number,
  x2: number,
  y: number,
  stroke: string = WIREFRAME_PALETTE.border,
  width: number = 2,
): string =>
  `<line x1="${numberAttribute(x1)}" y1="${numberAttribute(y)}" x2="${numberAttribute(x2)}" y2="${numberAttribute(y)}" stroke="${stroke}" stroke-width="${numberAttribute(width)}"/>`;

export const renderText = (options: TTextOptions): string => {
  if (
    options.lines.length === 0 ||
    options.lines.some((line) => line.length === 0)
  ) {
    throw new Error('SVG text requires non-empty visible lines');
  }
  const id = options.id ? ` id="${escapeXml(options.id)}"` : '';
  const primitive = options.primitive
    ? ` data-primitive="${escapeXml(options.primitive)}"`
    : '';
  const anchor = options.anchor ?? 'start';
  const fill = options.fill ?? WIREFRAME_PALETTE.ink;
  const weight = options.weight ?? 400;
  if (!SAFE_SVG_COLOR.test(fill)) {
    throw new Error('renderText requires a safe SVG fill color');
  }
  if (!SAFE_FONT_WEIGHTS.has(weight)) {
    throw new Error('renderText requires an approved font weight');
  }
  if (!SAFE_TEXT_ANCHORS.has(anchor)) {
    throw new Error('renderText requires an approved text anchor');
  }
  const tspans = options.lines
    .map(
      (line, index) =>
        `<tspan x="${numberAttribute(options.x)}" dy="${numberAttribute(index === 0 ? 0 : options.lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<text${id}${primitive} x="${numberAttribute(options.x)}" y="${numberAttribute(options.y)}" fill="${fill}" font-family="Plus Jakarta Sans" font-size="${numberAttribute(options.fontSize)}" font-weight="${weight}" text-anchor="${anchor}">${tspans}</text>`;
};

export const renderHeadingText = (options: TTextOptions): string =>
  renderText({ ...options, weight: 700, primitive: 'heading-text' });

export const renderBodyText = (options: TTextOptions): string =>
  renderText({ ...options, weight: 400, primitive: 'body-text' });

export const renderLabelText = (options: TTextOptions): string =>
  renderText({ ...options, weight: 600, primitive: 'label-text' });

export const renderHelperText = (options: TTextOptions): string =>
  renderText({
    ...options,
    fill: WIREFRAME_PALETTE.inkMuted,
    weight: 400,
    primitive: 'helper-text',
  });

export const renderStatusText = (options: TTextOptions): string =>
  renderText({ ...options, weight: 600, primitive: 'status-text' });

export const renderAppChrome = (rect: TRect, surfaceLabel: string): string => {
  assertRect(rect);
  const dividerX = rect.x + 184;
  return `<g data-primitive="app-chrome">
    <rect ${rectAttributes(rect)} rx="12" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>
    <rect x="${numberAttribute(rect.x)}" y="${numberAttribute(rect.y)}" width="184" height="${numberAttribute(rect.height)}" rx="12" fill="${WIREFRAME_PALETTE.surfaceMuted}"/>
    <line x1="${numberAttribute(dividerX)}" y1="${numberAttribute(rect.y)}" x2="${numberAttribute(dividerX)}" y2="${numberAttribute(rect.y + rect.height)}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/>
    ${renderLabelText({ x: rect.x + 20, y: rect.y + 34, lines: [surfaceLabel], fontSize: 16, lineHeight: 20 })}
    ${horizontalLine(rect.x + 20, rect.x + 152, rect.y + 54)}
    ${horizontalLine(rect.x + 20, rect.x + 128, rect.y + 68)}
  </g>`;
};

export const renderPanel = (
  rect: TRect,
  role: 'primary' | 'states' | 'directory',
): string => {
  const fill = role === 'primary' ? WIREFRAME_PALETTE.surface : '#FAFAFB';
  return `<rect data-primitive="${role}-panel" ${rectAttributes(rect)} rx="12" fill="${fill}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/>`;
};

export const renderCard = (rect: TRect): string =>
  `<rect data-primitive="card" ${rectAttributes(rect)} rx="10" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/>`;

export const renderInput = ({ rect, label }: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const fieldY = inner.y + Math.min(24, inner.height * 0.3);
  const fieldHeight = Math.max(18, inner.height - (fieldY - inner.y));
  return `<g data-primitive="input">
    ${renderLabelText({ x: inner.x, y: inner.y + 15, lines: [label], fontSize: 14, lineHeight: 18 })}
    <rect x="${numberAttribute(inner.x)}" y="${numberAttribute(fieldY)}" width="${numberAttribute(inner.width)}" height="${numberAttribute(fieldHeight)}" rx="7" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>
    ${horizontalLine(inner.x + 12, inner.x + inner.width * 0.66, fieldY + fieldHeight / 2, WIREFRAME_PALETTE.border)}
  </g>`;
};

export const renderSelect = ({ rect, label }: TLabeledRectOptions): string => {
  const input = renderInput({ rect, label });
  const x = rect.x + rect.width - 22;
  const y = rect.y + rect.height - 20;
  return `<g data-primitive="select">${input}<path d="M ${numberAttribute(x - 6)} ${numberAttribute(y - 3)} L ${numberAttribute(x)} ${numberAttribute(y + 3)} L ${numberAttribute(x + 6)} ${numberAttribute(y - 3)}" fill="none" stroke="${WIREFRAME_PALETTE.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
};

export const renderTextarea = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const fieldY = inner.y + Math.min(24, inner.height * 0.25);
  return `<g data-primitive="textarea">
    ${renderLabelText({ x: inner.x, y: inner.y + 15, lines: [label], fontSize: 14, lineHeight: 18 })}
    <rect x="${numberAttribute(inner.x)}" y="${numberAttribute(fieldY)}" width="${numberAttribute(inner.width)}" height="${numberAttribute(inner.y + inner.height - fieldY)}" rx="7" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>
    ${horizontalLine(inner.x + 12, inner.x + inner.width * 0.78, fieldY + 16)}
    ${horizontalLine(inner.x + 12, inner.x + inner.width * 0.56, fieldY + 30)}
  </g>`;
};

export const renderCheckbox = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const boxSize = Math.min(22, rect.height - 8);
  const boxY = rect.y + (rect.height - boxSize) / 2;
  return `<g data-primitive="checkbox">
    <rect x="${numberAttribute(rect.x + 6)}" y="${numberAttribute(boxY)}" width="${numberAttribute(boxSize)}" height="${numberAttribute(boxSize)}" rx="4" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.dustyRose}" stroke-width="2" data-accent-purpose="focus"/>
    ${renderLabelText({ x: rect.x + boxSize + 16, y: rect.y + rect.height / 2 + 5, lines: [label], fontSize: 14, lineHeight: 18 })}
  </g>`;
};

export const renderSwitch = ({ rect, label }: TLabeledRectOptions): string => {
  const width = Math.min(50, rect.width * 0.26);
  const height = Math.min(26, rect.height - 8);
  const x = rect.x + rect.width - width - 6;
  const y = rect.y + (rect.height - height) / 2;
  return `<g data-primitive="switch">
    ${renderLabelText({ x: rect.x + 6, y: rect.y + rect.height / 2 + 5, lines: [label], fontSize: 14, lineHeight: 18 })}
    <rect x="${numberAttribute(x)}" y="${numberAttribute(y)}" width="${numberAttribute(width)}" height="${numberAttribute(height)}" rx="13" fill="${WIREFRAME_PALETTE.dustyRoseMuted}" stroke="${WIREFRAME_PALETTE.dustyRose}" stroke-width="2" data-accent-purpose="selection"/>
    <circle cx="${numberAttribute(x + width - height / 2)}" cy="${numberAttribute(y + height / 2)}" r="${numberAttribute(height / 2 - 4)}" fill="${WIREFRAME_PALETTE.dustyRose}" data-accent-purpose="selection"/>
  </g>`;
};

export const renderButton = (
  rect: TRect,
  label: string,
  tone: TButtonTone,
): string => {
  assertRect(rect);
  const isPrimary = tone === 'primary';
  const fill = isPrimary
    ? WIREFRAME_PALETTE.dustyRose
    : WIREFRAME_PALETTE.surface;
  const stroke = isPrimary
    ? WIREFRAME_PALETTE.dustyRose
    : WIREFRAME_PALETTE.borderStrong;
  const prefix = tone === 'destructive' ? 'Xác nhận · ' : '';
  return `<g data-primitive="${tone}-button">
    <rect ${rectAttributes(rect)} rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"${isPrimary ? ' data-accent-purpose="primary-cta"' : ''}/>
    ${renderLabelText({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 + 5, lines: [`${prefix}${label}`], fontSize: 14, lineHeight: 18, fill: WIREFRAME_PALETTE.ink, anchor: 'middle' })}
  </g>`;
};

export const renderAlert = ({ rect, label }: TLabeledRectOptions): string =>
  `<g data-primitive="alert"><rect ${rectAttributes(rect)} rx="8" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${renderStatusText({ x: rect.x + 16, y: rect.y + Math.min(28, rect.height / 2 + 5), lines: [`Thông báo · ${label}`], fontSize: 14, lineHeight: 18 })}</g>`;

export const renderBadge = ({ rect, label }: TLabeledRectOptions): string => {
  const badge = insetRect(rect, Math.min(8, rect.height * 0.16));
  return `<g data-primitive="badge"><rect ${rectAttributes(badge)} rx="${numberAttribute(badge.height / 2)}" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${renderStatusText({ x: badge.x + badge.width / 2, y: badge.y + badge.height / 2 + 5, lines: [label], fontSize: 14, lineHeight: 18, anchor: 'middle' })}</g>`;
};

export const renderChecklist = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 10);
  const rowHeight = inner.height / 3;
  const rows = Array.from({ length: 3 }, (_, index) => {
    const cy = inner.y + rowHeight * index + rowHeight / 2;
    return `<rect x="${numberAttribute(inner.x)}" y="${numberAttribute(cy - 7)}" width="14" height="14" rx="3" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${horizontalLine(inner.x + 24, inner.x + inner.width - 4, cy)}`;
  }).join('');
  return `<g data-primitive="checklist" aria-label="${escapeXml(label)}">${rows}</g>`;
};

export const renderTable = ({ rect, label }: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const rowHeight = inner.height / 4;
  const columnX = inner.x + inner.width * 0.42;
  const rows = Array.from({ length: 5 }, (_, index) =>
    horizontalLine(inner.x, inner.x + inner.width, inner.y + index * rowHeight),
  ).join('');
  return `<g data-primitive="table" aria-label="${escapeXml(label)}"><rect ${rectAttributes(inner)} fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/><rect x="${numberAttribute(inner.x)}" y="${numberAttribute(inner.y)}" width="${numberAttribute(inner.width)}" height="${numberAttribute(rowHeight)}" fill="${WIREFRAME_PALETTE.surfaceMuted}"/>${rows}<line x1="${numberAttribute(columnX)}" y1="${numberAttribute(inner.y)}" x2="${numberAttribute(columnX)}" y2="${numberAttribute(inner.y + inner.height)}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/></g>`;
};

export const renderList = ({ rect, label }: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const rowHeight = inner.height / 3;
  const rows = Array.from({ length: 3 }, (_, index) => {
    const y = inner.y + rowHeight * index;
    return `<rect x="${numberAttribute(inner.x)}" y="${numberAttribute(y)}" width="${numberAttribute(inner.width)}" height="${numberAttribute(rowHeight - 5)}" rx="6" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/><circle cx="${numberAttribute(inner.x + 16)}" cy="${numberAttribute(y + (rowHeight - 5) / 2)}" r="6" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.borderStrong}"/>${horizontalLine(inner.x + 30, inner.x + inner.width * 0.72, y + (rowHeight - 5) / 2)}`;
  }).join('');
  return `<g data-primitive="list" aria-label="${escapeXml(label)}">${rows}</g>`;
};

export const renderFilter = ({ rect, label }: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const searchWidth = inner.width * 0.58;
  return `<g data-primitive="filter" aria-label="${escapeXml(label)}"><rect x="${numberAttribute(inner.x)}" y="${numberAttribute(inner.y)}" width="${numberAttribute(searchWidth)}" height="${numberAttribute(inner.height)}" rx="7" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${horizontalLine(inner.x + 14, inner.x + searchWidth * 0.72, inner.y + inner.height / 2)}<rect x="${numberAttribute(inner.x + searchWidth + 10)}" y="${numberAttribute(inner.y)}" width="${numberAttribute(inner.width - searchWidth - 10)}" height="${numberAttribute(inner.height)}" rx="7" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/></g>`;
};

export const renderPagination = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const size = Math.min(28, rect.height - 6);
  const totalWidth = size * 4 + 18;
  const startX = rect.x + Math.max(0, rect.width - totalWidth);
  const items = Array.from({ length: 4 }, (_, index) => {
    const x = startX + index * (size + 6);
    return `<rect x="${numberAttribute(x)}" y="${numberAttribute(rect.y + (rect.height - size) / 2)}" width="${numberAttribute(size)}" height="${numberAttribute(size)}" rx="6" fill="${index === 1 ? WIREFRAME_PALETTE.dustyRoseMuted : WIREFRAME_PALETTE.surface}" stroke="${index === 1 ? WIREFRAME_PALETTE.dustyRose : WIREFRAME_PALETTE.border}" stroke-width="2"${index === 1 ? ' data-accent-purpose="selection"' : ''}/>`;
  }).join('');
  return `<g data-primitive="pagination" aria-label="${escapeXml(label)}">${items}</g>`;
};

export const renderModal = ({ rect, label }: TLabeledRectOptions): string => {
  const modal = insetRect(rect, Math.min(18, rect.width * 0.08));
  return `<g data-primitive="modal" aria-label="${escapeXml(label)}"><rect ${rectAttributes(rect)} rx="8" fill="${WIREFRAME_PALETTE.surfaceMuted}" opacity="0.82"/><rect ${rectAttributes(modal)} rx="10" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${horizontalLine(modal.x + 14, modal.x + modal.width - 14, modal.y + 34)}</g>`;
};

export const renderSheet = ({ rect, label }: TLabeledRectOptions): string => {
  const width = rect.width * 0.62;
  const sheet: TRect = {
    x: rect.x + rect.width - width,
    y: rect.y,
    width,
    height: rect.height,
  };
  return `<g data-primitive="sheet" aria-label="${escapeXml(label)}"><rect ${rectAttributes(rect)} fill="${WIREFRAME_PALETTE.surfaceMuted}" opacity="0.76"/><rect ${rectAttributes(sheet)} fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${horizontalLine(sheet.x + 14, sheet.x + sheet.width - 14, sheet.y + 36)}</g>`;
};

export const renderTabs = ({ rect, label }: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const width = inner.width / 3;
  const tabs = Array.from({ length: 3 }, (_, index) => {
    const x = inner.x + width * index;
    return `<rect x="${numberAttribute(x)}" y="${numberAttribute(inner.y)}" width="${numberAttribute(width)}" height="${numberAttribute(inner.height)}" fill="${index === 0 ? WIREFRAME_PALETTE.dustyRoseMuted : WIREFRAME_PALETTE.surface}" stroke="${index === 0 ? WIREFRAME_PALETTE.dustyRose : WIREFRAME_PALETTE.border}" stroke-width="2"${index === 0 ? ' data-accent-purpose="selection"' : ''}/>`;
  }).join('');
  return `<g data-primitive="tabs" aria-label="${escapeXml(label)}">${tabs}</g>`;
};

export const renderAccordion = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const rowHeight = inner.height / 3;
  const rows = Array.from({ length: 3 }, (_, index) => {
    const y = inner.y + index * rowHeight;
    return `<rect x="${numberAttribute(inner.x)}" y="${numberAttribute(y)}" width="${numberAttribute(inner.width)}" height="${numberAttribute(rowHeight - 4)}" rx="5" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/><path d="M ${numberAttribute(inner.x + inner.width - 22)} ${numberAttribute(y + rowHeight / 2 - 3)} l 6 6 l 6 -6" fill="none" stroke="${WIREFRAME_PALETTE.ink}" stroke-width="2"/>`;
  }).join('');
  return `<g data-primitive="accordion" aria-label="${escapeXml(label)}">${rows}</g>`;
};

export const renderChart = ({ rect, label }: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 10);
  const baseline = inner.y + inner.height - 4;
  const barWidth = Math.max(4, inner.width / 11);
  const heights = [0.34, 0.58, 0.46, 0.78, 0.64] as const;
  const bars = heights
    .map((ratio, index) => {
      const height = inner.height * ratio;
      return `<rect x="${numberAttribute(inner.x + index * barWidth * 2)}" y="${numberAttribute(baseline - height)}" width="${numberAttribute(barWidth)}" height="${numberAttribute(height)}" rx="3" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.borderStrong}"/>`;
    })
    .join('');
  return `<g data-primitive="chart" aria-label="${escapeXml(label)}">${horizontalLine(inner.x, inner.x + inner.width, baseline, WIREFRAME_PALETTE.borderStrong)}${bars}</g>`;
};

export const renderEvidence = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 10);
  const points = [
    [inner.x + inner.width * 0.15, inner.y + inner.height * 0.6],
    [inner.x + inner.width * 0.5, inner.y + inner.height * 0.28],
    [inner.x + inner.width * 0.82, inner.y + inner.height * 0.64],
  ] as const;
  const path = points
    .map(([x, y]) => `${numberAttribute(x)},${numberAttribute(y)}`)
    .join(' ');
  const nodes = points
    .map(
      ([x, y]) =>
        `<circle cx="${numberAttribute(x)}" cy="${numberAttribute(y)}" r="10" fill="${WIREFRAME_PALETTE.dustyRoseMuted}" stroke="${WIREFRAME_PALETTE.dustyRose}" stroke-width="2" data-accent-purpose="selection"/>`,
    )
    .join('');
  return `<g data-primitive="evidence" aria-label="${escapeXml(label)}"><polyline points="${path}" fill="none" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${nodes}</g>`;
};

export const renderTimeline = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 10);
  const x = inner.x + 14;
  const nodes = Array.from({ length: 4 }, (_, index) => {
    const y = inner.y + (inner.height * index) / 3;
    return `<circle cx="${numberAttribute(x)}" cy="${numberAttribute(y)}" r="6" fill="${index === 0 ? WIREFRAME_PALETTE.dustyRose : WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"${index === 0 ? ' data-accent-purpose="selection"' : ''}/>${horizontalLine(x + 16, inner.x + inner.width, y)}`;
  }).join('');
  return `<g data-primitive="timeline" aria-label="${escapeXml(label)}"><line x1="${numberAttribute(x)}" y1="${numberAttribute(inner.y)}" x2="${numberAttribute(x)}" y2="${numberAttribute(inner.y + inner.height)}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${nodes}</g>`;
};

export const renderLedger = ({ rect, label }: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  const rowHeight = inner.height / 4;
  const rows = Array.from({ length: 4 }, (_, index) => {
    const y = inner.y + index * rowHeight;
    return `${horizontalLine(inner.x, inner.x + inner.width, y)}${horizontalLine(inner.x + inner.width * 0.72, inner.x + inner.width - 4, y + rowHeight / 2, WIREFRAME_PALETTE.borderStrong)}`;
  }).join('');
  return `<g data-primitive="ledger" aria-label="${escapeXml(label)}"><rect ${rectAttributes(inner)} fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>${rows}</g>`;
};

export const renderMediaPlaceholder = (
  rect: TRect,
  label: string,
  kind: TMediaKind,
): string => {
  const inner = insetRect(rect, 8);
  const isAvatar = kind === 'avatar';
  const shape = isAvatar
    ? `<circle cx="${numberAttribute(inner.x + inner.width / 2)}" cy="${numberAttribute(inner.y + inner.height / 2)}" r="${numberAttribute(Math.min(inner.width, inner.height) * 0.3)}" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>`
    : `<rect ${rectAttributes(inner)} rx="8" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.borderStrong}" stroke-width="2"/>`;
  const symbol =
    kind === 'video' || kind === 'live'
      ? `<path d="M ${numberAttribute(inner.x + inner.width / 2 - 8)} ${numberAttribute(inner.y + inner.height / 2 - 12)} L ${numberAttribute(inner.x + inner.width / 2 + 14)} ${numberAttribute(inner.y + inner.height / 2)} L ${numberAttribute(inner.x + inner.width / 2 - 8)} ${numberAttribute(inner.y + inner.height / 2 + 12)} Z" fill="${WIREFRAME_PALETTE.borderStrong}"/>`
      : '';
  return `<g data-primitive="${kind}-placeholder" aria-label="${escapeXml(`Vùng giữ chỗ trung tính · ${label}`)}">${shape}${symbol}</g>`;
};

export const renderGenericPlaceholder = ({
  rect,
  label,
}: TLabeledRectOptions): string => {
  const inner = insetRect(rect, 8);
  return `<g data-primitive="generic-placeholder" aria-label="${escapeXml(label)}"><rect ${rectAttributes(inner)} rx="8" fill="${WIREFRAME_PALETTE.surfaceMuted}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2" stroke-dasharray="8 6"/>${horizontalLine(inner.x + 14, inner.x + inner.width * 0.72, inner.y + inner.height / 2)}</g>`;
};

export const renderPlaceholder = (
  kind: TPlaceholderKind,
  rect: TRect,
  label: string,
): string => {
  if (kind === 'form') return renderInput({ rect, label });
  if (kind === 'table') return renderTable({ rect, label });
  if (kind === 'list') return renderList({ rect, label });
  if (kind === 'chart') return renderChart({ rect, label });
  if (kind === 'evidence') return renderEvidence({ rect, label });
  if (kind === 'timeline') return renderTimeline({ rect, label });
  if (kind === 'ledger') return renderLedger({ rect, label });
  if (kind === 'image' || kind === 'avatar' || kind === 'video') {
    return renderMediaPlaceholder(rect, label, kind);
  }
  return renderGenericPlaceholder({ rect, label });
};

export const renderAnnotationMarker = (
  rect: TRect,
  annotationCode: string,
): string => {
  const width = Math.max(46, annotationCode.length * 11 + 14);
  const x = rect.x + rect.width - width - 8;
  const y = rect.y + 8;
  return `<g data-primitive="annotation-marker" data-annotation-marker="${escapeXml(annotationCode)}"><rect x="${numberAttribute(x)}" y="${numberAttribute(y)}" width="${numberAttribute(width)}" height="26" rx="13" fill="${WIREFRAME_PALETTE.dustyRoseMuted}" stroke="${WIREFRAME_PALETTE.dustyRose}" stroke-width="2" data-accent-purpose="annotation-ownership"/>${renderLabelText({ x: x + width / 2, y: y + 18, lines: [annotationCode], fontSize: 14, lineHeight: 18, anchor: 'middle' })}</g>`;
};

export const renderDirectoryEntry = (
  rect: TRect,
  componentId: string,
  lines: readonly [string, string, string],
): string => {
  const text = lines
    .map((line, index) =>
      renderHelperText({
        x: rect.x + 7,
        y: rect.y + 16 + index * 16,
        lines: [line],
        fontSize: 14,
        lineHeight: 16,
      }),
    )
    .join('');
  return `<g data-primitive="directory-entry" data-directory-component-id="${escapeXml(componentId)}"><rect ${rectAttributes(rect)} rx="7" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.dustyRose}" stroke-width="2" data-accent-purpose="annotation-ownership"/>${text}</g>`;
};
