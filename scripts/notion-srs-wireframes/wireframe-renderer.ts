import { auditScreenGeometry } from './geometry-audit.ts';
import { measureVisibleText, wrapVisibleText } from './layout-recipes.ts';
import {
  escapeXml,
  renderAccordion,
  renderAlert,
  renderAnnotationMarker,
  renderAppChrome,
  renderBadge,
  renderBodyText,
  renderButton,
  renderChart,
  renderCheckbox,
  renderChecklist,
  renderDirectoryEntry,
  renderEvidence,
  renderFilter,
  renderHeadingText,
  renderInput,
  renderLabelText,
  renderLedger,
  renderList,
  renderMediaPlaceholder,
  renderModal,
  renderPagination,
  renderPanel,
  renderPlaceholder,
  renderSelect,
  renderSheet,
  renderStatusText,
  renderSwitch,
  renderTable,
  renderTabs,
  renderTextarea,
  renderTimeline,
  WIREFRAME_PALETTE,
} from './scene-primitives.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';

import type {
  TComponentPlacement,
  TPlaceholderPrimitive,
  TRect,
  TScreenComponent,
  TScreenContract,
  TScreenLayout,
  TTypographyPrimitive,
} from './types.ts';

type TNodeHash = {
  update(data: Uint8Array): TNodeHash;
  digest(encoding: 'hex'): string;
};

declare const process: {
  getBuiltinModule(moduleId: 'node:crypto'): {
    createHash(algorithm: 'sha256'): TNodeHash;
  };
};

const { createHash } = process.getBuiltinModule('node:crypto');

const SVG_WARNING =
  'Visual aid; component contract và nội dung SRS chuẩn tắc vẫn là nguồn quyết định.';

const SURFACE_LABELS = Object.freeze({
  storefront: 'Cửa hàng',
  vendor: 'Cổng đối tác',
  admin: 'Quản trị',
} as const);

const RECIPE_LABELS = Object.freeze({
  dashboard: 'tổng quan',
  form: 'biểu mẫu',
  list: 'danh sách',
  detail: 'chi tiết',
  composer: 'trình soạn nội dung',
  viewer: 'trình xem',
  evidence: 'bằng chứng',
  reconciliation: 'đối soát',
} as const);

const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

const TRUE_TYPE_SIGNATURE = 0x0001_0000;
const TRUE_TYPE_HEAD_MAGIC = 0x5f0f_3cf5;
const MAX_FONT_BYTE_LENGTH = 5 * 1024 * 1024;
const PINNED_PLUS_JAKARTA_SHA256 =
  '89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8';
const REQUIRED_TRUE_TYPE_TABLES = Object.freeze([
  'OS/2',
  'cmap',
  'glyf',
  'head',
  'hhea',
  'hmtx',
  'loca',
  'maxp',
  'name',
  'post',
]);

type TTrueTypeTable = Readonly<{
  offset: number;
  length: number;
}>;

const readUint16 = (bytes: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 2 > bytes.length) {
    throw new Error('uint16 leaves font bounds');
  }
  const high = bytes[offset];
  const low = bytes[offset + 1];
  if (high === undefined || low === undefined) {
    throw new Error('uint16 is incomplete');
  }
  return high * 0x100 + low;
};

const readUint32 = (bytes: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error('uint32 leaves font bounds');
  }
  const first = bytes[offset];
  const second = bytes[offset + 1];
  const third = bytes[offset + 2];
  const fourth = bytes[offset + 3];
  if (
    first === undefined ||
    second === undefined ||
    third === undefined ||
    fourth === undefined
  ) {
    throw new Error('uint32 is incomplete');
  }
  return first * 0x100_0000 + second * 0x1_0000 + third * 0x100 + fourth;
};

const readTableTag = (bytes: Uint8Array, offset: number): string => {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error('table tag leaves font bounds');
  }
  const codes = Array.from(bytes.slice(offset, offset + 4));
  if (codes.some((code) => code < 0x20 || code > 0x7e)) {
    throw new Error('table tag is not printable ASCII');
  }
  return String.fromCharCode(...codes);
};

const decodeCanonicalBase64 = (fontData: string): Uint8Array => {
  let binary: string;
  try {
    binary = atob(fontData);
  } catch {
    throw new Error('font base64 cannot be decoded');
  }
  if (btoa(binary) !== fontData) {
    throw new Error('font base64 is not canonical');
  }
  if (binary.length === 0 || binary.length > MAX_FONT_BYTE_LENGTH) {
    throw new Error('font byte length is outside the approved range');
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const readTrueTypeTables = (
  bytes: Uint8Array,
): ReadonlyMap<string, TTrueTypeTable> => {
  if (bytes.length < 12 || readUint32(bytes, 0) !== TRUE_TYPE_SIGNATURE) {
    throw new Error('font does not use the TrueType sfnt signature');
  }
  const tableCount = readUint16(bytes, 4);
  if (tableCount === 0 || tableCount > 256) {
    throw new Error('font table count is outside the approved range');
  }
  const directoryLength = 12 + tableCount * 16;
  if (directoryLength > bytes.length) {
    throw new Error('font table directory leaves font bounds');
  }

  const tables = new Map<string, TTrueTypeTable>();
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = readTableTag(bytes, recordOffset);
    const offset = readUint32(bytes, recordOffset + 8);
    const length = readUint32(bytes, recordOffset + 12);
    if (
      tables.has(tag) ||
      length === 0 ||
      offset < directoryLength ||
      offset > bytes.length ||
      length > bytes.length - offset
    ) {
      throw new Error(`invalid TrueType table record: ${tag}`);
    }
    tables.set(tag, { offset, length });
  }
  for (const tag of REQUIRED_TRUE_TYPE_TABLES) {
    if (!tables.has(tag)) {
      throw new Error(`missing mandatory TrueType table: ${tag}`);
    }
  }
  return tables;
};

const decodeUtf16BigEndian = (bytes: Uint8Array): string => {
  if (bytes.length % 2 !== 0) return '';
  let result = '';
  for (let index = 0; index < bytes.length; index += 2) {
    result += String.fromCharCode(readUint16(bytes, index));
  }
  return result;
};

const normalizedFontName = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\s_-]+/gu, '');

const hasPlusJakartaFamilyName = (
  bytes: Uint8Array,
  table: TTrueTypeTable,
): boolean => {
  if (table.length < 6) return false;
  const tableEnd = table.offset + table.length;
  const recordCount = readUint16(bytes, table.offset + 2);
  const storageOffset = readUint16(bytes, table.offset + 4);
  const recordsEnd = table.offset + 6 + recordCount * 12;
  const storageStart = table.offset + storageOffset;
  if (
    recordsEnd > tableEnd ||
    storageStart < recordsEnd ||
    storageStart > tableEnd
  ) {
    return false;
  }

  const approvedNameIds = new Set([1, 4, 6, 16, 17]);
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = table.offset + 6 + index * 12;
    const platformId = readUint16(bytes, recordOffset);
    const nameId = readUint16(bytes, recordOffset + 6);
    const length = readUint16(bytes, recordOffset + 8);
    const stringOffset = readUint16(bytes, recordOffset + 10);
    if (!approvedNameIds.has(nameId)) continue;
    const start = storageStart + stringOffset;
    const end = start + length;
    if (start < storageStart || end > tableEnd) continue;
    const value =
      platformId === 0 || platformId === 3
        ? decodeUtf16BigEndian(bytes.slice(start, end))
        : String.fromCharCode(...bytes.slice(start, end));
    if (normalizedFontName(value).includes('plusjakartasans')) return true;
  }
  return false;
};

const assertValidPlusJakartaTrueType = (bytes: Uint8Array): void => {
  try {
    const tables = readTrueTypeTables(bytes);
    const head = tables.get('head');
    const maxp = tables.get('maxp');
    const name = tables.get('name');
    if (!head || head.length < 54) {
      throw new Error('head table is incomplete');
    }
    if (readUint32(bytes, head.offset + 12) !== TRUE_TYPE_HEAD_MAGIC) {
      throw new Error('head table magic is invalid');
    }
    if (!maxp || maxp.length < 6 || readUint16(bytes, maxp.offset + 4) === 0) {
      throw new Error('maxp table does not declare glyphs');
    }
    if (!name || !hasPlusJakartaFamilyName(bytes, name)) {
      throw new Error('name table does not declare Plus Jakarta Sans');
    }
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(
      `renderWireframe requires valid Plus Jakarta Sans TrueType font data${detail}`,
    );
  }
};

const assertFontData = (fontData: string): void => {
  if (
    fontData.length === 0 ||
    fontData.length % 4 !== 0 ||
    !BASE64_PATTERN.test(fontData)
  ) {
    throw new Error('renderWireframe requires canonical base64 font data');
  }
  const bytes = decodeCanonicalBase64(fontData);
  if (
    createHash('sha256').update(bytes).digest('hex') !==
    PINNED_PLUS_JAKARTA_SHA256
  ) {
    throw new Error(
      'renderWireframe requires the exact pinned Plus Jakarta Sans TrueType font',
    );
  }
  assertValidPlusJakartaTrueType(bytes);
};

const assertExactSequence = (
  actual: readonly string[],
  expected: readonly string[],
  message: string,
): void => {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(message);
  }
};

const isSemanticRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSemanticallyEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => isSemanticallyEqual(value, right[index]))
    );
  }
  if (!isSemanticRecord(left) || !isSemanticRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && isSemanticallyEqual(left[key], right[key]),
    )
  );
};

const assertRenderableLayout = (
  screen: TScreenContract,
  layout: TScreenLayout,
): void => {
  const authoritativeScreen = SCREEN_CONTRACTS.find(
    (candidate) => candidate.code === screen.code,
  );
  if (
    !authoritativeScreen ||
    !isSemanticallyEqual(screen, authoritativeScreen)
  ) {
    throw new Error(
      `${screen.code}: renderer requires the exact authoritative screen contract`,
    );
  }
  if (layout.fidelity !== 'wireframe') {
    throw new Error(
      `${screen.code}: renderWireframe requires wireframe fidelity`,
    );
  }
  if (layout.width !== 1920 || layout.height !== 1440) {
    throw new Error(`${screen.code}: renderer requires a 1920x1440 layout`);
  }
  if (layout.screenCode !== screen.code) {
    throw new Error(
      `${screen.code}: layout screen code is ${layout.screenCode}`,
    );
  }
  if (layout.recipe !== screen.layoutRecipe) {
    throw new Error(
      `${screen.code}: layout recipe ${layout.recipe} does not match ${screen.layoutRecipe}`,
    );
  }
  assertExactSequence(
    layout.contractComponentIds,
    screen.components.map((component) => component.id),
    `${screen.code}: layout component contract does not match screen`,
  );
  assertExactSequence(
    layout.componentPlacements.map((placement) => placement.componentId),
    screen.components.map((component) => component.id),
    `${screen.code}: component placement order does not match screen`,
  );
  assertExactSequence(
    layout.directoryPlacements.map((placement) => placement.componentId),
    screen.components.map((component) => component.id),
    `${screen.code}: annotation directory does not match screen`,
  );
  assertExactSequence(
    layout.contractStates,
    screen.states,
    `${screen.code}: layout states do not match screen`,
  );
  const geometryErrors = auditScreenGeometry(layout);
  if (geometryErrors.length > 0) {
    throw new Error(
      `${screen.code}: unaudited wireframe layout: ${geometryErrors.join('; ')}`,
    );
  }
};

const sanitizeSvgId = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replaceAll('Đ', 'D')
    .replaceAll('đ', 'd')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

const truncateLine = (
  value: string,
  maxWidth: number,
  fontSize: number,
): string => {
  if (measureVisibleText(value, fontSize) <= maxWidth) return value;
  const characters = Array.from(value);
  while (characters.length > 0) {
    characters.pop();
    const candidate = `${characters.join('').trimEnd()}…`;
    if (measureVisibleText(candidate, fontSize) <= maxWidth) return candidate;
  }
  return '…';
};

const fitLines = (
  value: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
): readonly string[] => {
  const normalized = value.replace(/\s+/gu, ' ').trim() || '—';
  const wrapped = wrapVisibleText(normalized, maxWidth, fontSize).map((line) =>
    line.trim(),
  );
  if (wrapped.length <= maxLines) return wrapped;
  const result = wrapped.slice(0, maxLines);
  const finalIndex = result.length - 1;
  const finalLine = result[finalIndex];
  if (finalLine !== undefined) {
    result[finalIndex] = truncateLine(`${finalLine}…`, maxWidth, fontSize);
  }
  return result;
};

const typographyPrimitive = (
  layout: TScreenLayout,
  id: string,
): TTypographyPrimitive | null => {
  const primitive = layout.scenePrimitives.find(
    (candidate): candidate is TTypographyPrimitive =>
      candidate.kind === 'text' && candidate.id === id,
  );
  return primitive ?? null;
};

const placeholderPrimitive = (
  layout: TScreenLayout,
  componentId: string,
): TPlaceholderPrimitive | null => {
  const id = `placeholder:component:${componentId}`;
  const primitive = layout.scenePrimitives.find(
    (candidate): candidate is TPlaceholderPrimitive =>
      candidate.kind === 'placeholder' && candidate.id === id,
  );
  return primitive ?? null;
};

const renderLayoutText = (
  primitive: TTypographyPrimitive,
  maximumWidth = primitive.rect.width,
): string => {
  const lines = fitLines(
    primitive.text,
    maximumWidth,
    primitive.fontSize,
    primitive.maxLines,
  );
  const options = {
    id: primitive.id,
    x: primitive.rect.x,
    y: primitive.rect.y + primitive.fontSize,
    lines,
    fontSize: primitive.fontSize,
    lineHeight: primitive.lineHeight,
  } as const;
  if (primitive.role === 'screen-title' || primitive.role === 'heading') {
    return renderHeadingText(options);
  }
  if (primitive.role === 'component-label') return renderLabelText(options);
  if (primitive.role === 'status') return renderStatusText(options);
  return renderBodyText(options);
};

const renderFormControl = (
  component: TScreenComponent,
  rect: TRect,
): string => {
  const type = component.type.toLocaleLowerCase('vi');
  const options = { rect, label: component.label } as const;
  if (/textarea|vùng văn bản|ô nhiều dòng/iu.test(type)) {
    return renderTextarea(options);
  }
  if (/checkbox|hộp kiểm|nhóm lựa chọn/iu.test(type)) {
    return renderCheckbox(options);
  }
  if (/switch|công tắc/iu.test(type)) return renderSwitch(options);
  if (/select|bộ chọn|picker|dropdown/iu.test(type)) {
    return renderSelect(options);
  }
  return renderInput(options);
};

const renderSemanticPlaceholder = (
  component: TScreenComponent,
  placement: TComponentPlacement,
  primitive: TPlaceholderPrimitive,
): string => {
  const type = component.type.toLocaleLowerCase('vi');
  const options = { rect: primitive.rect, label: primitive.label } as const;

  if (/modal|hộp thoại/iu.test(type)) return renderModal(options);
  if (/sheet|ngăn kéo|bảng trượt/iu.test(type)) return renderSheet(options);
  if (/tabs?|thẻ tab/iu.test(type)) return renderTabs(options);
  if (/accordion|vùng thu gọn/iu.test(type)) return renderAccordion(options);
  if (/filter|bộ lọc|tìm kiếm/iu.test(type)) return renderFilter(options);
  if (/pagination|phân trang/iu.test(type)) return renderPagination(options);
  if (/checkbox|hộp kiểm/iu.test(type)) return renderCheckbox(options);
  if (/switch|công tắc/iu.test(type)) return renderSwitch(options);
  if (/textarea|vùng văn bản|ô nhiều dòng/iu.test(type)) {
    return renderTextarea(options);
  }
  if (/select|bộ chọn|picker|dropdown/iu.test(type)) {
    return renderSelect(options);
  }
  if (placement.visualRole === 'field') {
    return renderFormControl(component, primitive.rect);
  }
  if (placement.visualRole === 'action') {
    return renderButton(primitive.rect, component.label, 'secondary');
  }
  if (/alert|cảnh báo/iu.test(type)) return renderAlert(options);
  if (/badge|huy hiệu|trạng thái/iu.test(type)) return renderBadge(options);
  if (/checklist|danh sách kiểm tra/iu.test(type)) {
    return renderChecklist(options);
  }
  if (/table|bảng|lưới dữ liệu/iu.test(type)) return renderTable(options);
  if (/list|danh sách|feed|directory/iu.test(type)) return renderList(options);
  if (/chart|biểu đồ/iu.test(type)) return renderChart(options);
  if (/evidence|bằng chứng|chứng cứ|graph|đồ thị/iu.test(type)) {
    return renderEvidence(options);
  }
  if (/timeline|dòng thời gian/iu.test(type)) return renderTimeline(options);
  if (/ledger|sổ cái|đối soát|settlement/iu.test(type)) {
    return renderLedger(options);
  }
  if (/live/iu.test(type)) {
    return renderMediaPlaceholder(primitive.rect, primitive.label, 'live');
  }
  return renderPlaceholder(
    primitive.placeholderKind,
    primitive.rect,
    primitive.label,
  );
};

const renderComponent = (
  screen: TScreenContract,
  layout: TScreenLayout,
  placement: TComponentPlacement,
): string => {
  const component = screen.components[placement.contractIndex];
  if (!component || component.id !== placement.componentId) {
    throw new Error(`${screen.code}/${placement.componentId}: owner mismatch`);
  }
  const label = typographyPrimitive(
    layout,
    `text:component:${component.id}:label`,
  );
  const body = typographyPrimitive(
    layout,
    `text:component:${component.id}:body`,
  );
  if (!label || !body) {
    throw new Error(`${screen.code}/${component.id}: missing layout text`);
  }
  const placeholder = placeholderPrimitive(layout, component.id);
  const markerReserve = Math.max(62, component.annotationCode.length * 11 + 24);
  const visibleLabel = renderLayoutText(
    label,
    Math.max(64, label.rect.width - markerReserve),
  );
  const visibleBody = renderLayoutText(body);
  const semantic = placeholder
    ? renderSemanticPlaceholder(component, placement, placeholder)
    : '';

  return `<g data-component-id="${escapeXml(component.id)}" data-visual-role="${escapeXml(placement.visualRole)}" data-region="${escapeXml(placement.region)}">
    <rect x="${placement.rect.x}" y="${placement.rect.y}" width="${placement.rect.width}" height="${placement.rect.height}" rx="10" fill="${WIREFRAME_PALETTE.surface}" stroke="${WIREFRAME_PALETTE.border}" stroke-width="2"/>
    ${visibleLabel}
    ${visibleBody}
    ${semantic}
  </g>`;
};

const renderBackgroundLayer = (
  screen: TScreenContract,
  layout: TScreenLayout,
): string => {
  const { chrome, primary, states, directory } = layout.zones;
  if (!chrome || !primary || !states || !directory) {
    throw new Error(`${screen.code}: missing fixed wireframe zones`);
  }
  return `<g data-layer="backgrounds">
    <rect x="0" y="0" width="1920" height="1440" fill="${WIREFRAME_PALETTE.page}"/>
    ${renderAppChrome(chrome, SURFACE_LABELS[screen.surface])}
    ${renderPanel(primary, 'primary')}
    ${renderPanel(states, 'states')}
    ${renderPanel(directory, 'directory')}
  </g>`;
};

const renderComponentsLayer = (
  screen: TScreenContract,
  layout: TScreenLayout,
): string => {
  const chrome = layout.zones.chrome;
  if (!chrome || !layout.safeExitPlacement) {
    throw new Error(`${screen.code}: missing chrome actions`);
  }
  const titleWidth = Math.max(320, chrome.width - 700);
  const header = [
    renderHeadingText({
      id: `${sanitizeSvgId(screen.code)}-visible-title`,
      x: chrome.x + 208,
      y: chrome.y + 35,
      lines: fitLines(
        `${screen.code} — ${screen.displayTitle}`,
        titleWidth,
        24,
        1,
      ),
      fontSize: 24,
      lineHeight: 30,
    }),
    renderBodyText({
      x: chrome.x + 208,
      y: chrome.y + 65,
      lines: fitLines(`${screen.actor} · ${screen.route}`, titleWidth, 16, 1),
      fontSize: 16,
      lineHeight: 20,
    }),
    renderButton(
      layout.safeExitPlacement.rect,
      layout.safeExitPlacement.displayLabel,
      'secondary',
    ),
  ].join('');
  const components = layout.componentPlacements
    .map((placement) => renderComponent(screen, layout, placement))
    .join('');
  const primaryAction = layout.primaryActionPlacement
    ? renderButton(
        layout.primaryActionPlacement.rect,
        layout.primaryActionPlacement.displayLabel,
        'primary',
      )
    : '';
  return `<g data-layer="components">${header}${components}${primaryAction}</g>`;
};

const renderMarkerLayer = (layout: TScreenLayout): string =>
  `<g data-layer="markers">${layout.componentPlacements
    .map((placement) =>
      renderAnnotationMarker(placement.rect, placement.annotationCode),
    )
    .join('')}</g>`;

const renderStateLayer = (layout: TScreenLayout): string => {
  const states = layout.zones.states;
  if (!states) throw new Error(`${layout.screenCode}: missing state strip`);
  const legend = renderLabelText({
    x: states.x + 12,
    y: states.y - 7,
    lines: ['Trạng thái màn hình'],
    fontSize: 14,
    lineHeight: 18,
  });
  const items = layout.statePlacements
    .map((placement) => {
      const selected = placement.state === 'ready' || placement.index === 0;
      const fill = selected
        ? WIREFRAME_PALETTE.dustyRoseMuted
        : WIREFRAME_PALETTE.surface;
      const stroke = selected
        ? WIREFRAME_PALETTE.dustyRose
        : WIREFRAME_PALETTE.border;
      const label = typographyPrimitive(
        layout,
        `text:state:${placement.index}`,
      );
      if (!label) {
        throw new Error(
          `${layout.screenCode}/${placement.state}: missing state label`,
        );
      }
      return `<g data-screen-state="${escapeXml(placement.state)}" aria-label="${escapeXml(placement.displayLabel)}"><rect x="${placement.rect.x}" y="${placement.rect.y}" width="${placement.rect.width}" height="${placement.rect.height}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"${selected ? ' data-accent-purpose="selection"' : ''}/>${renderLayoutText(label)}</g>`;
    })
    .join('');
  return `<g data-layer="states">${legend}${items}</g>`;
};

const renderDirectoryLayer = (layout: TScreenLayout): string => {
  const directory = layout.zones.directory;
  if (!directory) {
    throw new Error(`${layout.screenCode}: missing annotation directory`);
  }
  const legend = renderLabelText({
    x: directory.x + 12,
    y: directory.y - 7,
    lines: ['Danh mục chú thích'],
    fontSize: 14,
    lineHeight: 18,
  });
  const entries = layout.directoryPlacements
    .map((placement) => {
      const lines = [0, 1, 2].map((lineIndex) => {
        const primitive = typographyPrimitive(
          layout,
          `text:directory:${placement.componentId}:${lineIndex}`,
        );
        if (!primitive) {
          throw new Error(
            `${layout.screenCode}/${placement.componentId}: missing directory line`,
          );
        }
        return primitive.text;
      }) as [string, string, string];
      return renderDirectoryEntry(placement.rect, placement.componentId, lines);
    })
    .join('');
  return `<g data-layer="directory">${legend}${entries}</g>`;
};

const renderWarningLayer = (): string =>
  `<g data-layer="warning">${renderBodyText({ x: 32, y: 1432, lines: [SVG_WARNING], fontSize: 14, lineHeight: 18 })}</g>`;

export const renderWireframe = (
  screen: TScreenContract,
  layout: TScreenLayout,
  fontData: string,
): string => {
  assertFontData(fontData);
  assertRenderableLayout(screen, layout);
  const rootId = sanitizeSvgId(screen.code);
  const titleId = `${rootId}-title`;
  const descriptionId = `${rootId}-description`;
  const title = `${screen.code} — ${screen.displayTitle}`;
  const description = `Bản phác thảo giao diện desktop cho ${screen.displayTitle}. Vai trò: ${screen.actor}. Bố cục: ${RECIPE_LABELS[screen.layoutRecipe]}.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1440" viewBox="0 0 1920 1440" role="img" aria-labelledby="${titleId} ${descriptionId}" data-screen-code="${escapeXml(screen.code)}" data-font-family="Plus Jakarta Sans">
  <title id="${titleId}">${escapeXml(title)}</title>
  <desc id="${descriptionId}">${escapeXml(description)}</desc>
  <defs><style>@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:200 800;font-display:block;src:url('data:font/ttf;base64,${fontData}') format('truetype')}text{font-family:'Plus Jakarta Sans'}</style></defs>
  ${renderBackgroundLayer(screen, layout)}
  ${renderComponentsLayer(screen, layout)}
  ${renderMarkerLayer(layout)}
  ${renderStateLayer(layout)}
  ${renderDirectoryLayer(layout)}
  ${renderWarningLayer()}
</svg>`;
};
