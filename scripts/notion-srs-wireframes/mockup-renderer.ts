import { BENADEP_RENDER_TOKENS, BENADEP_THEME } from './benadep-theme.ts';
import {
  layoutScreen,
  measureVisibleText,
  wrapVisibleText,
} from './layout-recipes.ts';
import { MOCKUP_SCREEN_CODES } from './manifest.ts';
import { escapeXml } from './scene-primitives.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';
import type {
  TComponentPlacement,
  TRect,
  TScreenCode,
  TScreenComponent,
  TScreenContract,
  TScreenLayout,
  TScreenState,
} from './types.ts';
import { renderWireframe } from './wireframe-renderer.ts';

type TTextRole = 'body' | 'annotation' | 'label' | 'placeholder' | 'status';

type TMockVisual =
  | 'hero-card'
  | 'checklist'
  | 'status'
  | 'accordion'
  | 'field'
  | 'chart'
  | 'table'
  | 'actions'
  | 'result'
  | 'alert'
  | 'timeline'
  | 'calculation'
  | 'virtual-feed'
  | 'video-player'
  | 'live-player'
  | 'profile'
  | 'products'
  | 'disclosure'
  | 'chat'
  | 'upload'
  | 'countdown'
  | 'stats-cards'
  | 'ledger'
  | 'diff'
  | 'toolbar';

type TCompositionConfiguration = Readonly<{
  id: string;
  visuals: Readonly<Record<string, TMockVisual>>;
  proofRail?: true;
}>;

type TComposition = (
  screen: TScreenContract,
  layout: TScreenLayout,
  fontData: string,
) => string;

const WARNING =
  'Visual aid; component contract và nội dung SRS chuẩn tắc vẫn là nguồn quyết định.';

const SURFACE_LABELS = Object.freeze({
  storefront: 'Cửa hàng Benadep',
  vendor: 'Cổng đối tác Benadep',
  admin: 'Tiện ích quản trị Benadep',
} as const);

const SAFE_HEX = /^#[0-9A-F]{6}$/u;

const numberAttribute = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new Error('Mockup SVG coordinates must be finite');
  }
  return String(Object.is(value, -0) ? 0 : Math.round(value * 1000) / 1000);
};

const assertRect = (rect: TRect): void => {
  if (
    ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new Error('Mockup SVG rectangles must be positive and finite');
  }
};

const rectAttributes = (rect: TRect): string => {
  assertRect(rect);
  return `x="${numberAttribute(rect.x)}" y="${numberAttribute(rect.y)}" width="${numberAttribute(rect.width)}" height="${numberAttribute(rect.height)}"`;
};

const inset = (rect: TRect, amount: number): TRect => ({
  x: rect.x + amount,
  y: rect.y + amount,
  width: Math.max(1, rect.width - amount * 2),
  height: Math.max(1, rect.height - amount * 2),
});

const truncateLine = (
  value: string,
  maximumWidth: number,
  fontSize: number,
): string => {
  if (measureVisibleText(value, fontSize) <= maximumWidth) return value;
  const characters = Array.from(value);
  while (characters.length > 0) {
    characters.pop();
    const candidate = `${characters.join('').trimEnd()}…`;
    if (measureVisibleText(candidate, fontSize) <= maximumWidth) {
      return candidate;
    }
  }
  return '…';
};

const fitLines = (
  value: string,
  maximumWidth: number,
  fontSize: number,
  maximumLines: number,
): readonly string[] => {
  const normalized = value.replace(/\s+/gu, ' ').trim() || '—';
  const wrapped = wrapVisibleText(normalized, maximumWidth, fontSize).map(
    (line) => line.trim(),
  );
  if (wrapped.length <= maximumLines) return wrapped;
  const result = wrapped.slice(0, maximumLines);
  const finalIndex = result.length - 1;
  const finalLine = result[finalIndex];
  if (finalLine !== undefined) {
    result[finalIndex] = truncateLine(
      `${finalLine.replace(/…$/u, '')}…`,
      maximumWidth,
      fontSize,
    );
  }
  return result;
};

const renderText = (options: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly text: string;
  readonly fontSize: number;
  readonly lineHeight?: number;
  readonly maximumLines?: number;
  readonly weight?: 400 | 500 | 600 | 700 | 800;
  readonly fill?: string;
  readonly role: TTextRole;
  readonly anchor?: 'start' | 'middle' | 'end';
}): string => {
  const fill = options.fill ?? BENADEP_RENDER_TOKENS.ink;
  if (!SAFE_HEX.test(fill)) {
    throw new Error('Mockup text requires a safe resolved hex color');
  }
  const anchor = options.anchor ?? 'start';
  const lineHeight = options.lineHeight ?? Math.round(options.fontSize * 1.4);
  const lines = fitLines(
    options.text,
    options.width,
    options.fontSize,
    options.maximumLines ?? 1,
  );
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${numberAttribute(options.x)}" dy="${numberAttribute(index === 0 ? 0 : lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<text data-a11y-kind="text" data-text-role="${options.role}" x="${numberAttribute(options.x)}" y="${numberAttribute(options.y)}" fill="${fill}" font-family="Plus Jakarta Sans" font-size="${numberAttribute(options.fontSize)}" font-weight="${options.weight ?? 400}" text-anchor="${anchor}">${tspans}</text>`;
};

const renderRect = (
  rect: TRect,
  options: {
    readonly fill: string;
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly radius?: number;
    readonly extra?: string;
  },
): string => {
  if (!SAFE_HEX.test(options.fill)) {
    throw new Error('Mockup rectangle requires a safe resolved hex fill');
  }
  if (options.stroke && !SAFE_HEX.test(options.stroke)) {
    throw new Error('Mockup rectangle requires a safe resolved hex stroke');
  }
  const stroke = options.stroke
    ? ` stroke="${options.stroke}" stroke-width="${numberAttribute(options.strokeWidth ?? 1)}"`
    : '';
  return `<rect ${options.extra ?? ''} ${rectAttributes(rect)} rx="${numberAttribute(options.radius ?? BENADEP_THEME.radius)}" fill="${options.fill}"${stroke}/>`;
};

const renderLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string = BENADEP_RENDER_TOKENS.border,
  strokeWidth = 2,
): string =>
  `<line x1="${numberAttribute(x1)}" y1="${numberAttribute(y1)}" x2="${numberAttribute(x2)}" y2="${numberAttribute(y2)}" stroke="${stroke}" stroke-width="${numberAttribute(strokeWidth)}" stroke-linecap="round"/>`;

const renderButton = (
  rect: TRect,
  label: string,
  tone: 'primary' | 'secondary' | 'destructive',
  focused = false,
  contractAction?: 'primary-action' | 'safe-exit',
): string => {
  const fill =
    tone === 'primary'
      ? BENADEP_THEME.primary
      : tone === 'destructive'
        ? BENADEP_RENDER_TOKENS.destructive
        : BENADEP_THEME.card;
  const foreground =
    tone === 'primary'
      ? BENADEP_RENDER_TOKENS.ink
      : tone === 'secondary'
        ? BENADEP_RENDER_TOKENS.ink
        : BENADEP_RENDER_TOKENS.white;
  const stroke =
    tone === 'secondary' ? BENADEP_RENDER_TOKENS.borderStrong : fill;
  const focusRect = inset(rect, -4);
  return `<g data-a11y-kind="control"${contractAction ? ` data-contract-action="${contractAction}"` : ''}>
    ${renderRect(rect, { fill, stroke, strokeWidth: 1, radius: 10 })}
    ${renderText({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 + 6, width: rect.width - 24, text: label, fontSize: 16, weight: 700, fill: foreground, role: 'body', anchor: 'middle', maximumLines: 1 })}
    ${focused ? `<rect data-a11y-kind="focus" ${rectAttributes(focusRect)} rx="14" fill="none" stroke="${BENADEP_RENDER_TOKENS.focus}" stroke-width="2"/>` : ''}
  </g>`;
};

const statusPalette = (
  state: TScreenState,
): Readonly<{ background: string; foreground: string; stroke: string }> => {
  if (state === 'success' || state === 'ready') {
    return {
      background: BENADEP_RENDER_TOKENS.successLight,
      foreground: BENADEP_RENDER_TOKENS.ink,
      stroke: BENADEP_RENDER_TOKENS.success,
    };
  }
  if (
    state === 'failed' ||
    state === 'query-error' ||
    state === 'validation-error' ||
    state === 'denied' ||
    state === 'rejected'
  ) {
    return {
      background: BENADEP_RENDER_TOKENS.errorLight,
      foreground: BENADEP_RENDER_TOKENS.ink,
      stroke: BENADEP_RENDER_TOKENS.destructive,
    };
  }
  if (
    state === 'pending' ||
    state === 'held' ||
    state === 'stale' ||
    state === 'expired' ||
    state === 'rate-limited'
  ) {
    return {
      background: BENADEP_RENDER_TOKENS.warningLight,
      foreground: BENADEP_RENDER_TOKENS.ink,
      stroke: BENADEP_THEME.deepPlum,
    };
  }
  return {
    background: BENADEP_RENDER_TOKENS.softBlush,
    foreground: BENADEP_RENDER_TOKENS.ink,
    stroke: BENADEP_RENDER_TOKENS.borderStrong,
  };
};

const renderStatusPill = (
  rect: TRect,
  state: TScreenState,
  label: string,
  screenState = false,
): string => {
  const palette = statusPalette(state);
  const normalizedLabel = label.replace(/\s+/gu, ' ').trim() || '—';
  const labelWidth = rect.width - 16;
  const lines = wrapVisibleText(normalizedLabel, labelWidth, 14).map((line) =>
    line.trim(),
  );
  if (lines.length > 2) {
    throw new Error(`${state}: full state label requires more than two lines`);
  }
  const lineHeight = 16;
  const firstBaseline =
    rect.y + (rect.height - lines.length * lineHeight) / 2 + 12;
  const stateAttribute = screenState
    ? `data-screen-state="${escapeXml(state)}"`
    : `data-status="${escapeXml(state)}"`;
  return `<g ${stateAttribute} aria-label="${escapeXml(normalizedLabel)}">
    ${renderRect(rect, { fill: palette.background, stroke: palette.stroke, strokeWidth: 1, radius: Math.min(10, rect.height / 2) })}
    ${renderText({ x: rect.x + 8, y: firstBaseline, width: labelWidth, text: normalizedLabel, fontSize: 14, lineHeight, maximumLines: lines.length, weight: 600, fill: palette.foreground, role: 'status' })}
  </g>`;
};

const selectComponentState = (
  component: TScreenComponent,
  preferred: readonly TScreenState[],
): TScreenState => {
  const match = preferred.find((state) => component.states.includes(state));
  const fallback = component.states[0];
  if (!match && !fallback) {
    throw new Error(`${component.id}: component must own at least one state`);
  }
  return match ?? (fallback as TScreenState);
};

const renderField = (rect: TRect, component: TScreenComponent): string => {
  const fieldRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: Math.max(44, Math.min(52, rect.height)),
  };
  return `${renderRect(fieldRect, {
    fill: BENADEP_THEME.card,
    stroke: BENADEP_RENDER_TOKENS.borderStrong,
    strokeWidth: 1,
    radius: 10,
  })}${renderText({
    x: fieldRect.x + 14,
    y: fieldRect.y + fieldRect.height / 2 + 5,
    width: fieldRect.width - 28,
    text: component.type,
    fontSize: 14,
    fill: BENADEP_RENDER_TOKENS.muted,
    role: 'placeholder',
  })}`;
};

const renderTable = (rect: TRect, label: string): string => {
  const table = inset(rect, 2);
  const rowCount = 4;
  const rowHeight = table.height / rowCount;
  const column = table.x + table.width * 0.62;
  const rows = Array.from({ length: rowCount + 1 }, (_, index) =>
    renderLine(
      table.x,
      table.y + index * rowHeight,
      table.x + table.width,
      table.y + index * rowHeight,
      BENADEP_RENDER_TOKENS.border,
      1,
    ),
  ).join('');
  return `<g data-visual="table">
    ${renderRect(table, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 8 })}
    ${renderLine(column, table.y, column, table.y + table.height, BENADEP_RENDER_TOKENS.border, 1)}
    ${rows}
    ${renderText({ x: table.x + 12, y: table.y + Math.min(22, rowHeight / 2 + 5), width: table.width * 0.55, text: `Dữ liệu minh hoạ · ${label}`, fontSize: 14, fill: BENADEP_RENDER_TOKENS.body, role: 'placeholder' })}
  </g>`;
};

const renderChart = (rect: TRect, label: string): string => {
  const chart = inset(rect, 2);
  const baseline = chart.y + chart.height - 8;
  const availableHeight = Math.max(2, baseline - (chart.y + 30));
  const bars = [0.34, 0.62, 0.48, 0.78, 0.56]
    .map((ratio, index) => {
      const width = Math.max(12, chart.width / 16);
      const height = availableHeight * ratio;
      return renderRect(
        {
          x: chart.x + 22 + index * width * 2,
          y: baseline - height,
          width,
          height,
        },
        {
          fill:
            index === 3 ? BENADEP_THEME.primary : BENADEP_THEME.primaryLight,
          radius: 4,
        },
      );
    })
    .join('');
  return `<g data-visual="chart">
    ${renderRect(chart, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 8 })}
    ${renderText({ x: chart.x + 12, y: chart.y + 22, width: chart.width - 24, text: `Biểu đồ minh hoạ · ${label}`, fontSize: 14, fill: BENADEP_RENDER_TOKENS.body, role: 'placeholder' })}
    ${renderLine(chart.x + 14, baseline, chart.x + chart.width - 14, baseline, BENADEP_RENDER_TOKENS.borderStrong, 1)}
    ${bars}
  </g>`;
};

const renderHeroCard = (rect: TRect, component: TScreenComponent): string => {
  const hero = inset(rect, 2);
  const badge = {
    x: hero.x + 20,
    y: hero.y + 18,
    width: Math.min(176, hero.width - 40),
    height: 36,
  };
  return `<g data-visual="hero-card" data-hierarchy="prominent">
    ${renderRect(hero, { fill: BENADEP_RENDER_TOKENS.softBlush, stroke: BENADEP_RENDER_TOKENS.borderStrong, strokeWidth: 1, radius: 14 })}
    ${renderRect(badge, { fill: BENADEP_THEME.primary, stroke: BENADEP_THEME.primary, strokeWidth: 1, radius: 18 })}
    ${renderText({ x: badge.x + badge.width / 2, y: badge.y + 23, width: badge.width - 20, text: 'TRUNG TÂM AFFILIATE', fontSize: 14, weight: 800, fill: BENADEP_RENDER_TOKENS.ink, role: 'annotation', anchor: 'middle' })}
    ${renderText({ x: hero.x + 20, y: hero.y + 84, width: hero.width - 40, text: component.label, fontSize: 22, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body', maximumLines: 2 })}
    ${renderText({ x: hero.x + 20, y: hero.y + Math.min(hero.height - 18, 132), width: hero.width - 40, text: 'Tổng quan điều kiện, tiến độ và bước tiếp theo', fontSize: 14, weight: 500, fill: BENADEP_RENDER_TOKENS.body, role: 'annotation', maximumLines: 2 })}
  </g>`;
};

const renderStatsCards = (rect: TRect, label: string): string => {
  const frame = inset(rect, 2);
  const gap = 10;
  const count = 3;
  const cardWidth = Math.max(1, (frame.width - gap * (count - 1)) / count);
  const cards = Array.from({ length: count }, (_, index) => {
    const card = {
      x: frame.x + index * (cardWidth + gap),
      y: frame.y,
      width: cardWidth,
      height: frame.height,
    };
    const value = ['12.840', '$4.280', '8,7%'][index] ?? '—';
    return `${renderRect(card, { fill: index === 1 ? BENADEP_RENDER_TOKENS.softBlush : BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 10 })}${renderText({ x: card.x + 12, y: card.y + 24, width: card.width - 24, text: `${label} · ${index + 1}`, fontSize: 14, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'annotation' })}${renderText({ x: card.x + 12, y: card.y + Math.min(card.height - 14, 58), width: card.width - 24, text: value, fontSize: 22, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body' })}`;
  }).join('');
  return `<g data-visual="stats-cards" aria-label="${escapeXml(label)}">${cards}</g>`;
};

const renderRows = (
  rect: TRect,
  label: string,
  kind: 'list' | 'checklist' | 'chat' | 'products',
): string => {
  const frame = inset(rect, 2);
  const gap = 8;
  const desiredCount = kind === 'products' ? 3 : 4;
  const fittingCount = Math.max(1, Math.floor((frame.height + gap) / 36));
  const count = Math.min(desiredCount, fittingCount);
  const rowHeight = Math.max(1, (frame.height - gap * (count - 1)) / count);
  const rows = Array.from({ length: count }, (_, index) => {
    const row = {
      x: frame.x,
      y: frame.y + index * (rowHeight + gap),
      width: frame.width,
      height: rowHeight,
    };
    const markerSize = Math.min(28, Math.max(14, row.height - 12));
    const marker =
      kind === 'products'
        ? renderRect(
            {
              x: row.x + 8,
              y: row.y + 6,
              width: markerSize,
              height: markerSize,
            },
            {
              fill: BENADEP_RENDER_TOKENS.softBlush,
              stroke: BENADEP_RENDER_TOKENS.border,
              strokeWidth: 1,
              radius: 6,
            },
          )
        : `<circle cx="${numberAttribute(row.x + 18)}" cy="${numberAttribute(row.y + row.height / 2)}" r="7" fill="${index === 0 ? BENADEP_THEME.primary : BENADEP_RENDER_TOKENS.softBlush}" stroke="${BENADEP_RENDER_TOKENS.borderStrong}" stroke-width="1"/>`;
    return `${renderRect(row, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 8 })}${marker}${renderLine(row.x + 40, row.y + row.height / 2, row.x + row.width * (0.62 + index * 0.04), row.y + row.height / 2, BENADEP_RENDER_TOKENS.borderStrong, 2)}`;
  }).join('');
  return `<g data-visual="${kind}" aria-label="${escapeXml(label)}">${rows}</g>`;
};

const renderMedia = (
  rect: TRect,
  component: TScreenComponent,
  live = false,
): string => {
  const media = inset(rect, 2);
  const centerX = media.x + media.width / 2;
  const centerY = media.y + media.height / 2;
  if (media.height < 96) {
    return `<g data-visual="neutral-media">
      ${renderRect(media, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.borderStrong, strokeWidth: 1, radius: 10 })}
      ${renderText({ x: centerX, y: centerY + 5, width: media.width - 28, text: `Vùng giữ chỗ trung tính${live ? ' · LIVE' : ''}`, fontSize: 14, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'placeholder', anchor: 'middle', maximumLines: 1 })}
    </g>`;
  }
  return `<g data-visual="neutral-media">
    ${renderRect(media, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.borderStrong, strokeWidth: 1, radius: 10 })}
    <circle cx="${numberAttribute(centerX)}" cy="${numberAttribute(centerY - 12)}" r="24" fill="${BENADEP_RENDER_TOKENS.softBlush}" stroke="${BENADEP_RENDER_TOKENS.borderStrong}" stroke-width="1"/>
    <path d="M ${numberAttribute(centerX - 7)} ${numberAttribute(centerY - 25)} L ${numberAttribute(centerX + 13)} ${numberAttribute(centerY - 12)} L ${numberAttribute(centerX - 7)} ${numberAttribute(centerY + 1)} Z" fill="${BENADEP_THEME.deepPlum}"/>
    ${renderText({ x: centerX, y: centerY + 34, width: media.width - 28, text: `Vùng giữ chỗ trung tính · ${component.label}${live ? ' · LIVE' : ''}`, fontSize: 14, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'placeholder', anchor: 'middle', maximumLines: 2 })}
  </g>`;
};

const renderVirtualFeed = (
  rect: TRect,
  component: TScreenComponent,
): string => {
  const frame = inset(rect, 2);
  const gap = 10;
  const cardWidth = Math.max(1, (frame.width - gap * 2) / 3);
  const cards = Array.from({ length: 3 }, (_, index) => {
    const card = {
      x: frame.x + index * (cardWidth + gap),
      y: frame.y,
      width: cardWidth,
      height: frame.height,
    };
    const previewHeight = Math.max(44, card.height * 0.66);
    return `${renderRect(card, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 10 })}${renderRect({ x: card.x + 8, y: card.y + 8, width: card.width - 16, height: Math.max(1, previewHeight - 8) }, { fill: BENADEP_RENDER_TOKENS.softBlush, radius: 8 })}${renderText({ x: card.x + 10, y: card.y + Math.min(card.height - 10, previewHeight + 22), width: card.width - 20, text: `Video đề xuất ${index + 1}`, fontSize: 14, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'placeholder' })}`;
  }).join('');
  return `<g data-visual="virtual-feed" aria-label="${escapeXml(component.label)}">${cards}</g>`;
};

const renderVideoPlayer = (rect: TRect, component: TScreenComponent): string =>
  `<g data-visual="video-player" data-hierarchy="active">${renderMedia(rect, component)}</g>`;

const renderLivePlayer = (rect: TRect, component: TScreenComponent): string => {
  const player = inset(rect, 2);
  const badge = {
    x: player.x + 24,
    y: player.y + 22,
    width: 92,
    height: 36,
  };
  return `<g data-visual="live-player" data-hierarchy="dominant">
    ${renderRect(player, { fill: BENADEP_RENDER_TOKENS.heading, stroke: BENADEP_RENDER_TOKENS.borderStrong, strokeWidth: 1, radius: 12 })}
    ${renderRect(badge, { fill: BENADEP_THEME.primary, stroke: BENADEP_THEME.primary, strokeWidth: 1, radius: 18 })}
    ${renderText({ x: badge.x + badge.width / 2, y: badge.y + 23, width: badge.width - 20, text: 'LIVE', fontSize: 14, weight: 800, fill: BENADEP_RENDER_TOKENS.ink, role: 'status', anchor: 'middle' })}
    <circle cx="${numberAttribute(player.x + player.width / 2)}" cy="${numberAttribute(player.y + player.height / 2 - 12)}" r="42" fill="${BENADEP_THEME.card}" fill-opacity="0.94"/>
    <path d="M ${numberAttribute(player.x + player.width / 2 - 11)} ${numberAttribute(player.y + player.height / 2 - 36)} L ${numberAttribute(player.x + player.width / 2 + 25)} ${numberAttribute(player.y + player.height / 2 - 12)} L ${numberAttribute(player.x + player.width / 2 - 11)} ${numberAttribute(player.y + player.height / 2 + 12)} Z" fill="${BENADEP_THEME.deepPlum}"/>
    ${renderText({ x: player.x + player.width / 2, y: player.y + player.height / 2 + 62, width: player.width - 48, text: `Vùng giữ chỗ trung tính · LIVE · ${component.label}`, fontSize: 16, weight: 700, fill: BENADEP_RENDER_TOKENS.white, role: 'placeholder', anchor: 'middle', maximumLines: 2 })}
  </g>`;
};

const renderTimeline = (rect: TRect, label: string): string => {
  const frame = inset(rect, 8);
  const x = frame.x + 14;
  const items = Array.from({ length: 4 }, (_, index) => {
    const y = frame.y + (frame.height * index) / 3;
    return `<circle cx="${numberAttribute(x)}" cy="${numberAttribute(y)}" r="7" fill="${index === 0 ? BENADEP_THEME.primary : BENADEP_THEME.card}" stroke="${BENADEP_RENDER_TOKENS.borderStrong}" stroke-width="2"/>${renderLine(x + 20, y, frame.x + frame.width, y, BENADEP_RENDER_TOKENS.borderStrong, 2)}`;
  }).join('');
  return `<g data-visual="timeline" aria-label="${escapeXml(label)}">${renderLine(x, frame.y, x, frame.y + frame.height, BENADEP_RENDER_TOKENS.borderStrong, 2)}${items}</g>`;
};

const renderCountdown = (rect: TRect, label: string): string => {
  const frame = inset(rect, 2);
  const gap = 8;
  const width = Math.max(1, (frame.width - gap * 2) / 3);
  const units = [
    ['02', 'ngày'],
    ['14', 'giờ'],
    ['38', 'phút'],
  ] as const;
  const cells = units
    .map(([value, unit], index) => {
      const cell = {
        x: frame.x + index * (width + gap),
        y: frame.y,
        width,
        height: frame.height,
      };
      return `${renderRect(cell, { fill: index === 0 ? BENADEP_RENDER_TOKENS.warningLight : BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 10 })}${renderText({ x: cell.x + cell.width / 2, y: cell.y + Math.min(cell.height - 28, 42), width: cell.width - 16, text: value, fontSize: 24, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body', anchor: 'middle' })}${renderText({ x: cell.x + cell.width / 2, y: cell.y + Math.min(cell.height - 8, 66), width: cell.width - 16, text: unit, fontSize: 14, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'annotation', anchor: 'middle' })}`;
    })
    .join('');
  return `<g data-visual="countdown" aria-label="${escapeXml(label)}">${cells}</g>`;
};

const renderLedger = (rect: TRect, label: string): string => {
  const frame = inset(rect, 2);
  const header = { x: frame.x, y: frame.y, width: frame.width, height: 38 };
  const body = {
    x: frame.x,
    y: frame.y + 44,
    width: frame.width,
    height: Math.max(1, frame.height - 44),
  };
  return `<g data-visual="ledger" aria-label="${escapeXml(label)}">
    ${renderRect(header, { fill: BENADEP_RENDER_TOKENS.softBlush, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 8 })}
    ${renderText({ x: header.x + 12, y: header.y + 24, width: header.width - 24, text: 'SỔ CÁI · GHI NỢ / GHI CÓ', fontSize: 14, weight: 800, fill: BENADEP_RENDER_TOKENS.ink, role: 'annotation' })}
    ${renderTable(body, label)}
  </g>`;
};

const renderDiff = (rect: TRect, label: string): string => {
  const frame = inset(rect, 2);
  const gap = 10;
  const width = Math.max(1, (frame.width - gap) / 2);
  const before = { x: frame.x, y: frame.y, width, height: frame.height };
  const after = {
    x: frame.x + width + gap,
    y: frame.y,
    width,
    height: frame.height,
  };
  const panel = (panelRect: TRect, title: string, added: boolean): string =>
    `${renderRect(panelRect, { fill: added ? BENADEP_RENDER_TOKENS.successLight : BENADEP_RENDER_TOKENS.errorLight, stroke: added ? BENADEP_RENDER_TOKENS.success : BENADEP_RENDER_TOKENS.destructive, strokeWidth: 1, radius: 8 })}${renderText({ x: panelRect.x + 12, y: panelRect.y + 24, width: panelRect.width - 24, text: title, fontSize: 14, weight: 800, fill: BENADEP_RENDER_TOKENS.ink, role: 'annotation' })}${renderLine(panelRect.x + 12, panelRect.y + 46, panelRect.x + panelRect.width - 12, panelRect.y + 46, BENADEP_RENDER_TOKENS.borderStrong, 2)}${renderLine(panelRect.x + 12, panelRect.y + 68, panelRect.x + panelRect.width * 0.76, panelRect.y + 68, BENADEP_RENDER_TOKENS.borderStrong, 2)}`;
  return `<g data-visual="diff" aria-label="${escapeXml(label)}">${panel(before, 'TRƯỚC · −', false)}${panel(after, 'SAU · +', true)}</g>`;
};

const renderToolbar = (rect: TRect, component: TScreenComponent): string => {
  const frame = inset(rect, 2);
  const gap = 10;
  const summaryWidth = Math.max(1, frame.width * 0.38);
  const eligibilityWidth = Math.max(1, frame.width - summaryWidth - gap);
  const summary = {
    x: frame.x,
    y: frame.y,
    width: summaryWidth,
    height: frame.height,
  };
  const eligibility = {
    x: frame.x + summaryWidth + gap,
    y: frame.y,
    width: eligibilityWidth,
    height: frame.height,
  };
  return `<g data-visual="toolbar" data-preview-kind="selection-eligibility" data-interactivity="none" aria-label="${escapeXml(component.label)}">
    ${renderRect(summary, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 10 })}
    <circle cx="${numberAttribute(summary.x + 22)}" cy="${numberAttribute(summary.y + summary.height / 2)}" r="8" fill="${BENADEP_RENDER_TOKENS.softBlush}" stroke="${BENADEP_RENDER_TOKENS.borderStrong}" stroke-width="1"/>
    ${renderText({ x: summary.x + 40, y: summary.y + summary.height / 2 + 5, width: summary.width - 52, text: '3 mục đang được xem xét', fontSize: 14, weight: 700, fill: BENADEP_RENDER_TOKENS.body, role: 'annotation' })}
    ${renderRect(eligibility, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 10 })}
    ${renderText({ x: eligibility.x + 14, y: eligibility.y + 23, width: eligibility.width - 28, text: 'Tính đủ điều kiện của lựa chọn', fontSize: 14, weight: 700, fill: BENADEP_RENDER_TOKENS.body, role: 'annotation' })}
    ${renderText({ x: eligibility.x + 14, y: eligibility.y + Math.min(47, eligibility.height - 8), width: eligibility.width - 28, text: '2 phù hợp · 1 cần xem lại chính sách', fontSize: 14, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'annotation' })}
  </g>`;
};

const renderAlert = (
  rect: TRect,
  component: TScreenComponent,
  preferredStates: readonly TScreenState[],
): string =>
  `<g data-visual="alert">${renderStatusPill(
    rect,
    selectComponentState(component, preferredStates),
    component.label,
  )}</g>`;

const renderActions = (
  rect: TRect,
  component: TScreenComponent,
  destructive = false,
): string => {
  const button = {
    x: rect.x,
    y: rect.y,
    width: Math.min(rect.width, 360),
    height: Math.min(rect.height, 48),
  };
  return renderButton(
    button,
    component.label,
    destructive ? 'destructive' : 'secondary',
  );
};

const renderVisual = (
  visual: TMockVisual,
  rect: TRect,
  component: TScreenComponent,
): string => {
  if (visual === 'field') return renderField(rect, component);
  if (visual === 'chart') return renderChart(rect, component.label);
  if (visual === 'table') return renderTable(rect, component.label);
  if (visual === 'hero-card') return renderHeroCard(rect, component);
  if (visual === 'stats-cards') {
    return renderStatsCards(rect, component.label);
  }
  if (visual === 'ledger') return renderLedger(rect, component.label);
  if (visual === 'diff') return renderDiff(rect, component.label);
  if (visual === 'checklist') {
    return renderRows(rect, component.label, 'checklist');
  }
  if (visual === 'chat') return renderRows(rect, component.label, 'chat');
  if (visual === 'products') {
    return renderRows(rect, component.label, 'products');
  }
  if (visual === 'timeline') {
    return renderTimeline(rect, component.label);
  }
  if (visual === 'countdown') return renderCountdown(rect, component.label);
  if (visual === 'virtual-feed') return renderVirtualFeed(rect, component);
  if (visual === 'video-player') return renderVideoPlayer(rect, component);
  if (visual === 'live-player') return renderLivePlayer(rect, component);
  if (visual === 'profile') {
    return renderRows(rect, component.label, 'list');
  }
  if (visual === 'toolbar') return renderToolbar(rect, component);
  if (visual === 'actions') {
    return renderActions(
      rect,
      component,
      /vô hiệu|gỡ|rời|từ chối/iu.test(component.label),
    );
  }
  if (visual === 'alert' || visual === 'disclosure') {
    return renderAlert(
      rect,
      component,
      visual === 'disclosure'
        ? ['stale', 'moderation', 'ready']
        : [
            'failed',
            'query-error',
            'dependency-unavailable',
            'remediation',
            'held',
            'stale',
            'ready',
          ],
    );
  }
  if (visual === 'status' || visual === 'result') {
    return renderStatusPill(
      rect,
      selectComponentState(component, [
        'ready',
        'success',
        'pending',
        'held',
        'loading',
      ]),
      component.label,
    );
  }
  if (visual === 'upload') {
    return `${renderRect(rect, { fill: BENADEP_RENDER_TOKENS.neutral, stroke: BENADEP_RENDER_TOKENS.borderStrong, strokeWidth: 1, radius: 10 })}${renderText({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 + 5, width: rect.width - 24, text: component.type, fontSize: 14, fill: BENADEP_RENDER_TOKENS.body, role: 'placeholder', anchor: 'middle' })}`;
  }
  if (visual === 'accordion') {
    return renderRows(rect, component.label, 'list');
  }
  if (visual === 'calculation') {
    return `${renderTable(rect, component.label)}${renderLine(rect.x + rect.width * 0.72, rect.y + 16, rect.x + rect.width - 16, rect.y + 16, BENADEP_THEME.deepPlum, 3)}`;
  }
  return renderRows(rect, component.label, 'list');
};

const componentContentRect = (
  placement: TComponentPlacement,
  hasTypeLine: boolean,
): TRect => {
  const top = hasTypeLine ? 64 : 40;
  return {
    x: placement.rect.x + 16,
    y: placement.rect.y + top,
    width: Math.max(1, placement.rect.width - 32),
    height: Math.max(1, placement.rect.height - top - 16),
  };
};

const LIVE_ROOM_RECTS: Readonly<Record<string, TRect>> = Object.freeze({
  D01: Object.freeze({ x: 48, y: 144, width: 1268, height: 570 }),
  D02: Object.freeze({ x: 1328, y: 144, width: 544, height: 132 }),
  D03: Object.freeze({ x: 1328, y: 288, width: 544, height: 276 }),
  D04: Object.freeze({ x: 48, y: 726, width: 1268, height: 370 }),
  A02: Object.freeze({ x: 1328, y: 576, width: 544, height: 128 }),
  D05: Object.freeze({ x: 1328, y: 716, width: 544, height: 128 }),
  D06: Object.freeze({ x: 1328, y: 856, width: 544, height: 240 }),
});

const usesAccountSidebar = (screen: TScreenContract): boolean =>
  screen.surface === 'storefront' &&
  screen.route.startsWith('/account/') &&
  screen.layoutRecipe !== 'viewer';

const adaptPlacementForComposition = (
  screen: TScreenContract,
  placement: TComponentPlacement,
): TComponentPlacement => {
  const liveRoomRect =
    screen.code === 'MH-030'
      ? LIVE_ROOM_RECTS[placement.componentId]
      : undefined;
  const sourceRect = liveRoomRect ?? placement.rect;
  const needsSidebarClearance =
    usesAccountSidebar(screen) || screen.surface === 'vendor';
  const right = sourceRect.x + sourceRect.width;
  const rect =
    needsSidebarClearance && sourceRect.x < 288 && right > 288
      ? { ...sourceRect, x: 288, width: right - 288 }
      : sourceRect;
  return { ...placement, rect };
};

const renderComponent = (
  screen: TScreenContract,
  layout: TScreenLayout,
  placement: TComponentPlacement,
  visual: TMockVisual,
  shadowId: string,
): string => {
  const component = screen.components[placement.contractIndex];
  if (!component || component.id !== placement.componentId) {
    throw new Error(
      `${screen.code}/${placement.componentId}: component owner mismatch`,
    );
  }
  const footer = placement.region === 'footer';
  const hasTypeLine = placement.rect.height >= 112 && !footer;
  const contentRect = componentContentRect(placement, hasTypeLine);
  const semantic = footer
    ? layout.primaryActionPlacement
      ? renderButton(
          layout.primaryActionPlacement.rect,
          layout.primaryActionPlacement.displayLabel,
          'primary',
          true,
          'primary-action',
        )
      : ''
    : renderVisual(visual, contentRect, component);
  const control = placement.interactive ? ' data-a11y-kind="control"' : '';
  const controlBoundary =
    placement.interactive ||
    placement.visualRole === 'field' ||
    placement.visualRole === 'action' ||
    placement.visualRole === 'navigation';
  return `<g data-component-id="${escapeXml(component.id)}" data-semantic-role="${escapeXml(placement.visualRole)}" data-region="${escapeXml(placement.region)}" data-visual-semantic="${escapeXml(visual)}"${control}>
    <rect ${rectAttributes(placement.rect)} rx="${BENADEP_THEME.radius}" fill="${BENADEP_THEME.card}" stroke="${controlBoundary ? BENADEP_RENDER_TOKENS.borderStrong : BENADEP_RENDER_TOKENS.border}" stroke-width="1" filter="url(#${shadowId})"/>
    ${renderText({ x: placement.rect.x + 16, y: placement.rect.y + 27, width: footer ? Math.max(220, placement.rect.width - 420) : placement.rect.width - 32, text: component.label, fontSize: 16, weight: 700, fill: BENADEP_THEME.deepPlum, role: 'label' })}
    ${hasTypeLine ? renderText({ x: placement.rect.x + 16, y: placement.rect.y + 50, width: placement.rect.width - 32, text: component.type, fontSize: 14, fill: BENADEP_RENDER_TOKENS.muted, role: 'annotation' }) : ''}
    ${semantic}
  </g>`;
};

const renderChrome = (
  screen: TScreenContract,
  layout: TScreenLayout,
  shadowId: string,
): string => {
  const chrome = layout.zones.chrome;
  const safeExit = layout.safeExitPlacement;
  if (!chrome || !safeExit) {
    throw new Error(`${screen.code}: high-fidelity chrome is incomplete`);
  }
  const title = `${screen.code} — ${screen.displayTitle}`;
  const safeExitButton = renderButton(
    safeExit.rect,
    safeExit.displayLabel,
    'secondary',
    false,
    'safe-exit',
  );

  if (screen.surface === 'vendor') {
    const topbar = { x: 0, y: 0, width: 1920, height: 80 };
    const sidebar = { x: 0, y: 80, width: 240, height: 1128 };
    return `<g data-layer="chrome" data-chrome-variant="vendor-portal">
      <g data-chrome-region="vendor-main">${renderRect({ x: 240, y: 80, width: 1680, height: 1128 }, { fill: BENADEP_RENDER_TOKENS.neutral, radius: 0 })}</g>
      <g data-chrome-region="vendor-topbar">
        ${renderRect(topbar, { fill: BENADEP_THEME.card, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 0 })}
        ${renderText({ x: 24, y: 49, width: 180, text: 'BENADEP · ĐỐI TÁC', fontSize: 18, weight: 800, fill: BENADEP_THEME.deepPlum, role: 'label' })}
        ${renderText({ x: 280, y: 49, width: 1160, text: title, fontSize: 22, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body' })}
        ${safeExitButton}
      </g>
      <g data-chrome-region="vendor-sidebar">
        ${renderRect(sidebar, { fill: BENADEP_THEME.card, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 0 })}
        ${renderText({ x: 24, y: 126, width: 192, text: 'Tổng quan', fontSize: 16, weight: 700, fill: BENADEP_RENDER_TOKENS.heading, role: 'body' })}
        ${renderText({ x: 24, y: 176, width: 192, text: 'Sản phẩm & hoa hồng', fontSize: 16, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'body', maximumLines: 2 })}
        ${renderText({ x: 24, y: 238, width: 192, text: 'Đối soát', fontSize: 16, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'body' })}
      </g>
    </g>`;
  }

  if (screen.surface === 'admin') {
    return `<g data-layer="chrome" data-chrome-variant="admin-extension">
      <g data-chrome-region="admin-extension-toolbar">
        <rect ${rectAttributes(chrome)} rx="${BENADEP_THEME.radius}" fill="${BENADEP_THEME.card}" stroke="${BENADEP_RENDER_TOKENS.border}" stroke-width="1" filter="url(#${shadowId})"/>
        ${renderText({ x: chrome.x + 24, y: chrome.y + 38, width: 220, text: 'Affiliate Operations', fontSize: 16, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'label' })}
        ${renderText({ x: chrome.x + 272, y: chrome.y + 38, width: 1120, text: title, fontSize: 22, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body' })}
        ${renderText({ x: chrome.x + 272, y: chrome.y + 67, width: 1120, text: 'Tiện ích theo phạm vi · không thay đổi shell quản trị toàn cục', fontSize: 14, weight: 500, fill: BENADEP_RENDER_TOKENS.muted, role: 'annotation' })}
        ${safeExitButton}
      </g>
    </g>`;
  }

  if (usesAccountSidebar(screen)) {
    const sidebar = { x: 32, y: 128, width: 240, height: 1064 };
    return `<g data-layer="chrome" data-chrome-variant="storefront-account">
      <g data-chrome-region="storefront-header">
        <rect ${rectAttributes(chrome)} rx="${BENADEP_THEME.radius}" fill="${BENADEP_THEME.card}" stroke="${BENADEP_RENDER_TOKENS.border}" stroke-width="1" filter="url(#${shadowId})"/>
        ${renderText({ x: chrome.x + 24, y: chrome.y + 54, width: 176, text: 'BENADEP', fontSize: 20, weight: 800, fill: BENADEP_THEME.deepPlum, role: 'label' })}
        ${renderText({ x: chrome.x + 224, y: chrome.y + 41, width: 1120, text: title, fontSize: 22, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body' })}
        ${renderText({ x: chrome.x + 224, y: chrome.y + 68, width: 1120, text: screen.actor, fontSize: 14, weight: 500, fill: BENADEP_RENDER_TOKENS.muted, role: 'annotation' })}
        ${safeExitButton}
      </g>
      <g data-chrome-region="account-sidebar">
        ${renderRect(sidebar, { fill: BENADEP_THEME.card, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 12 })}
        ${renderText({ x: 56, y: 174, width: 192, text: 'Tài khoản của tôi', fontSize: 16, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body' })}
        ${renderText({ x: 56, y: 224, width: 192, text: 'Hồ sơ', fontSize: 16, weight: 600, fill: BENADEP_RENDER_TOKENS.body, role: 'body' })}
        ${renderText({ x: 56, y: 270, width: 192, text: 'Affiliate', fontSize: 16, weight: 800, fill: BENADEP_THEME.deepPlum, role: 'body' })}
        ${renderText({ x: 56, y: 316, width: 192, text: SURFACE_LABELS.storefront, fontSize: 14, weight: 500, fill: BENADEP_RENDER_TOKENS.muted, role: 'annotation', maximumLines: 2 })}
      </g>
    </g>`;
  }

  return `<g data-layer="chrome" data-chrome-variant="storefront-viewer">
    <g data-chrome-region="viewer-header">
      <rect ${rectAttributes(chrome)} rx="${BENADEP_THEME.radius}" fill="${BENADEP_THEME.card}" stroke="${BENADEP_RENDER_TOKENS.border}" stroke-width="1" filter="url(#${shadowId})"/>
      ${renderText({ x: chrome.x + 24, y: chrome.y + 54, width: 176, text: 'BENADEP', fontSize: 20, weight: 800, fill: BENADEP_THEME.deepPlum, role: 'label' })}
      ${renderText({ x: chrome.x + 224, y: chrome.y + 41, width: 1120, text: title, fontSize: 22, weight: 800, fill: BENADEP_RENDER_TOKENS.heading, role: 'body' })}
      ${renderText({ x: chrome.x + 224, y: chrome.y + 68, width: 1120, text: 'Trải nghiệm xem · không dùng điều hướng tài khoản', fontSize: 14, weight: 500, fill: BENADEP_RENDER_TOKENS.muted, role: 'annotation' })}
      ${safeExitButton}
    </g>
  </g>`;
};

const renderStateStrip = (layout: TScreenLayout): string => {
  const states = layout.zones.states;
  if (!states) {
    throw new Error(
      `${layout.screenCode}: high-fidelity states are incomplete`,
    );
  }
  const pills = layout.statePlacements
    .map((placement) =>
      renderStatusPill(
        placement.rect,
        placement.state,
        placement.displayLabel,
        true,
      ),
    )
    .join('');
  return `<g data-layer="states" aria-label="Trạng thái màn hình">
    ${renderRect(states, { fill: BENADEP_THEME.card, stroke: BENADEP_RENDER_TOKENS.border, strokeWidth: 1, radius: 10 })}
    ${renderText({ x: states.x + 12, y: states.y - 8, width: 240, text: 'Trạng thái màn hình', fontSize: 14, weight: 700, fill: BENADEP_THEME.deepPlum, role: 'annotation' })}
    ${pills}
  </g>`;
};

const renderProofRail = (
  screen: TScreenContract,
  layout: TScreenLayout,
  gradientId: string,
): string => {
  const primary = layout.zones.primary;
  if (!primary) throw new Error(`${screen.code}: primary zone is incomplete`);
  const x = usesAccountSidebar(screen) ? 280 : primary.x + 8;
  return `<rect data-proof-rail="rose-to-plum" x="${numberAttribute(x)}" y="${numberAttribute(primary.y + 16)}" width="8" height="${numberAttribute(primary.height - 32)}" rx="4" fill="url(#${gradientId})"/>`;
};

const renderComposition = (
  screen: TScreenContract,
  layout: TScreenLayout,
  fontData: string,
  configuration: TCompositionConfiguration,
): string => {
  const rootId = screen.code.toLocaleLowerCase('en-US');
  const titleId = `${rootId}-mockup-title`;
  const descriptionId = `${rootId}-mockup-description`;
  const shadowId = `${rootId}-blush-shadow`;
  const gradientId = `${rootId}-proof-gradient`;
  const configuredComponentIds = Object.keys(configuration.visuals);
  const contractComponentIds = screen.components.map(
    (component) => component.id,
  );
  if (
    configuredComponentIds.length !== contractComponentIds.length ||
    configuredComponentIds.some(
      (componentId) => !contractComponentIds.includes(componentId),
    )
  ) {
    throw new Error(
      `${screen.code}: mockup composition must map every contract component exactly once`,
    );
  }
  const components = layout.componentPlacements
    .map((placement) => {
      const visual = configuration.visuals[placement.componentId];
      if (!visual) {
        throw new Error(
          `${screen.code}/${placement.componentId}: mockup visual is not configured`,
        );
      }
      return renderComponent(
        screen,
        layout,
        adaptPlacementForComposition(screen, placement),
        visual,
        shadowId,
      );
    })
    .join('');

  return `<svg xmlns="http:&#47;&#47;www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440" role="img" aria-labelledby="${titleId} ${descriptionId}" data-screen-code="${escapeXml(screen.code)}" data-fidelity="high-fidelity" data-font-family="Plus Jakarta Sans" data-composition="${escapeXml(configuration.id)}" data-surface="${escapeXml(screen.surface)}">
    <title id="${titleId}">${escapeXml(`${screen.code} — ${screen.displayTitle}`)}</title>
    <desc id="${descriptionId}">${escapeXml(`Mockup desktop high-fidelity Benadep cho ${screen.displayTitle}. Vai trò: ${screen.actor}.`)}</desc>
    <defs>
      <style>@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:200 800;font-display:block;src:url('data:font/ttf;base64,${fontData}') format('truetype')}text{font-family:'Plus Jakarta Sans'}</style>
      <filter id="${shadowId}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#7B4355" flood-opacity="0.10"/></filter>
      <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BENADEP_THEME.primaryLight}"/><stop offset="0.48" stop-color="${BENADEP_THEME.primary}"/><stop offset="1" stop-color="${BENADEP_THEME.deepPlum}"/></linearGradient>
    </defs>
    <g data-layer="backgrounds">${renderRect({ x: 0, y: 0, width: 1920, height: 1440 }, { fill: BENADEP_THEME.page, radius: 0 })}</g>
    ${renderChrome(screen, layout, shadowId)}
    <g data-layer="components">${configuration.proofRail ? renderProofRail(screen, layout, gradientId) : ''}${components}</g>
    ${renderStateStrip(layout)}
    <g data-layer="warning">${renderText({ x: 32, y: 1432, width: 1500, text: WARNING, fontSize: 14, fill: BENADEP_RENDER_TOKENS.muted, role: 'annotation' })}</g>
  </svg>`;
};

const renderAffiliateCenterEligibility: TComposition = (
  screen,
  layout,
  fontData,
) =>
  renderComposition(screen, layout, fontData, {
    id: 'affiliate-center-eligibility',
    visuals: {
      D01: 'hero-card',
      D02: 'checklist',
      A01: 'actions',
      D03: 'alert',
      A02: 'actions',
      D04: 'accordion',
    },
  });

const renderAffiliatePerformanceDashboard: TComposition = (
  screen,
  layout,
  fontData,
) =>
  renderComposition(screen, layout, fontData, {
    id: 'affiliate-performance-dashboard',
    visuals: {
      F01: 'field',
      F02: 'field',
      D01: 'stats-cards',
      D02: 'chart',
      D03: 'table',
      D04: 'disclosure',
      A01: 'actions',
      A02: 'actions',
    },
  });

const renderCustomLinkBuilder: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'custom-link-builder',
    visuals: {
      F01: 'field',
      F02: 'field',
      F03: 'field',
      A01: 'actions',
      D01: 'result',
      A02: 'actions',
      D02: 'alert',
    },
  });

const renderAttributionDecisionDetail: TComposition = (
  screen,
  layout,
  fontData,
) =>
  renderComposition(screen, layout, fontData, {
    id: 'attribution-decision-detail',
    proofRail: true,
    visuals: {
      D01: 'status',
      D02: 'status',
      D03: 'timeline',
      D04: 'table',
      D05: 'calculation',
      D06: 'timeline',
      A01: 'actions',
    },
  });

const renderVideoCommerceFeed: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'video-commerce-feed',
    visuals: {
      D01: 'virtual-feed',
      D02: 'video-player',
      D03: 'profile',
      D04: 'products',
      A01: 'actions',
      A02: 'actions',
      D05: 'disclosure',
    },
  });

const renderViewerLiveRoom: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'viewer-live-room',
    visuals: {
      D01: 'live-player',
      D02: 'status',
      D03: 'chat',
      D04: 'products',
      A01: 'actions',
      A02: 'actions',
      D05: 'disclosure',
      D06: 'alert',
    },
  });

const renderProductCommissionRates: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'product-commission-rates',
    visuals: {
      F01: 'field',
      F02: 'field',
      F03: 'field',
      F04: 'field',
      F05: 'field',
      F06: 'upload',
      D01: 'table',
      A01: 'actions',
    },
  });

const renderCollaborationInbox: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'collaboration-inbox',
    visuals: {
      F01: 'field',
      D01: 'chat',
      D02: 'status',
      D03: 'countdown',
      F02: 'field',
      F03: 'upload',
      A01: 'actions',
      A02: 'actions',
      D04: 'alert',
    },
  });

const renderMcnRosterManagement: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'mcn-roster-management',
    visuals: {
      F01: 'field',
      F02: 'field',
      A01: 'actions',
      D01: 'table',
      D02: 'timeline',
      A02: 'actions',
      D03: 'timeline',
    },
  });

const renderCreatorWallet: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'creator-wallet',
    visuals: {
      D01: 'stats-cards',
      D02: 'status',
      F01: 'field',
      D03: 'ledger',
      D04: 'alert',
      A01: 'actions',
    },
  });

const renderRiskCaseQueue: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'risk-case-queue',
    proofRail: true,
    visuals: {
      F01: 'field',
      D01: 'table',
      D02: 'field',
      A01: 'actions',
      D03: 'countdown',
      D04: 'toolbar',
    },
  });

const renderProductFeedHealth: TComposition = (screen, layout, fontData) =>
  renderComposition(screen, layout, fontData, {
    id: 'product-feed-health',
    proofRail: true,
    visuals: {
      F01: 'field',
      D01: 'stats-cards',
      D02: 'table',
      D03: 'diff',
      D04: 'alert',
      A01: 'actions',
      A02: 'actions',
      D05: 'timeline',
    },
  });

const COMPOSITIONS = Object.freeze({
  'MH-001': renderAffiliateCenterEligibility,
  'MH-006': renderAffiliatePerformanceDashboard,
  'MH-012': renderCustomLinkBuilder,
  'MH-018': renderAttributionDecisionDetail,
  'MH-022': renderVideoCommerceFeed,
  'MH-030': renderViewerLiveRoom,
  'MH-033': renderProductCommissionRates,
  'MH-036': renderCollaborationInbox,
  'MH-042': renderMcnRosterManagement,
  'MH-046': renderCreatorWallet,
  'MH-052': renderRiskCaseQueue,
  'MH-058': renderProductFeedHealth,
} satisfies Readonly<
  Record<(typeof MOCKUP_SCREEN_CODES)[number], TComposition>
>);

const semanticEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const assertRenderableMockup = (
  screen: TScreenContract,
  layout: TScreenLayout,
  fontData: string,
): TComposition => {
  const authoritativeScreen = SCREEN_CONTRACTS.find(
    (candidate) => candidate.code === screen.code,
  );
  if (!authoritativeScreen) {
    throw new Error(`${screen.code}: unknown authoritative screen contract`);
  }

  // Reuse Task 4's pinned TrueType parser/hash and exact contract validator.
  renderWireframe(
    screen,
    layoutScreen(authoritativeScreen, 'wireframe'),
    fontData,
  );

  const composition = COMPOSITIONS[screen.code as keyof typeof COMPOSITIONS];
  if (!composition) {
    throw new Error(`${screen.code}: screen is not an approved mockup target`);
  }
  if (
    layout.fidelity !== 'high-fidelity' ||
    layout.screenCode !== screen.code ||
    layout.width !== 1920 ||
    layout.height !== 1440 ||
    layout.zones.directory !== null
  ) {
    throw new Error(
      `${screen.code}: renderMockup requires a high-fidelity layout`,
    );
  }
  const authoritativeLayout = layoutScreen(
    authoritativeScreen,
    'high-fidelity',
  );
  if (!semanticEqual(layout, authoritativeLayout)) {
    throw new Error(
      `${screen.code}: renderer requires the authoritative high-fidelity layout`,
    );
  }
  return composition;
};

export const renderMockup = (
  screen: TScreenContract,
  layout: TScreenLayout,
  fontData: string,
): string => {
  const composition = assertRenderableMockup(screen, layout, fontData);
  return composition(screen, layout, fontData);
};

const compositionCodes = Object.keys(COMPOSITIONS) as TScreenCode[];
if (
  compositionCodes.length !== MOCKUP_SCREEN_CODES.length ||
  compositionCodes.some((code, index) => code !== MOCKUP_SCREEN_CODES[index])
) {
  throw new Error('Mockup compositions must match the approved MH sequence');
}
