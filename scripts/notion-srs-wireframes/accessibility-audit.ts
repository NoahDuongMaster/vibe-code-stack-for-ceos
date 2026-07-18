type TAttributes = Readonly<Record<string, string>>;

type TParsedNode = {
  readonly tag: string;
  readonly attributes: TAttributes;
  readonly start: number;
  end: number;
  readonly parent: TParsedNode | null;
  readonly children: TParsedNode[];
  textContent: string;
};

type TRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type TColor = Readonly<{
  red: number;
  green: number;
  blue: number;
  hex: string;
}>;

type TComposite = Readonly<{
  red: number;
  green: number;
  blue: number;
  alpha: number;
}>;

type TParseResult = Readonly<{
  roots: readonly TParsedNode[];
  errors: readonly string[];
}>;

const TAG_PATTERN = /<\/?[A-Za-z][^>]*>/gu;
const ATTRIBUTE_AT_CURSOR = /^([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/u;
const HEX_COLOR_PATTERN = /^#([0-9A-F]{6})$/iu;
const RGB_COLOR_PATTERN =
  /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/iu;
const SHAPE_TAGS = new Set(['circle', 'ellipse', 'rect']);
const NON_RENDERED_ANCESTORS = new Set([
  'clipPath',
  'defs',
  'filter',
  'linearGradient',
  'mask',
  'pattern',
  'radialGradient',
  'style',
]);

const parseOpeningTag = (
  raw: string,
): Readonly<{ attributes: TAttributes; errors: readonly string[] }> => {
  const errors: string[] = [];
  const prefix = /^<([A-Za-z][A-Za-z0-9:-]*)/u.exec(raw);
  if (!prefix) {
    return { attributes: Object.freeze({}), errors: ['thẻ XML không hợp lệ'] };
  }
  const endingLength = raw.endsWith('/>') ? 2 : 1;
  const bodyEnd = raw.length - endingLength;
  let cursor = prefix[0].length;
  const attributes: Record<string, string> = {};
  while (cursor < bodyEnd) {
    while (/\s/u.test(raw[cursor] ?? '')) cursor += 1;
    if (cursor >= bodyEnd) break;
    const match = ATTRIBUTE_AT_CURSOR.exec(raw.slice(cursor, bodyEnd));
    if (!match?.[1]) {
      errors.push(
        'thuộc tính SVG phải có giá trị dùng dấu nháy kép; không hỗ trợ single-quote hoặc giá trị không quote',
      );
      break;
    }
    if (attributes[match[1]] !== undefined) {
      errors.push(`thuộc tính SVG bị lặp: ${match[1]}`);
    }
    attributes[match[1]] = match[2] ?? '';
    if (match[1] === 'style') {
      errors.push(
        'thuộc tính style không được hỗ trợ vì có thể ghi đè fill, font-size hoặc display',
      );
    }
    cursor += match[0].length;
  }
  return { attributes: Object.freeze(attributes), errors };
};

const parseScene = (scene: string): TParseResult => {
  const roots: TParsedNode[] = [];
  const stack: TParsedNode[] = [];
  const errors: string[] = [];
  const tagRanges: Array<Readonly<{ start: number; end: number }>> = [];

  for (const match of scene.matchAll(TAG_PATTERN)) {
    const raw = match[0];
    const start = match.index;
    if (start === undefined) continue;
    tagRanges.push({ start, end: start + raw.length });
    const closing = raw.startsWith('</');
    const tagName = /^<\/?([A-Za-z][A-Za-z0-9:-]*)/u.exec(raw)?.[1];
    if (!tagName) {
      errors.push('XML chứa tên thẻ không hợp lệ');
      continue;
    }

    if (closing) {
      if (!new RegExp(`^</${tagName}\\s*>$`, 'u').test(raw)) {
        errors.push(`XML closing tag ${tagName} không hợp lệ`);
      }
      const node = stack.at(-1);
      if (!node || node.tag !== tagName) {
        errors.push(
          `XML đóng thẻ sai thứ tự: cần </${node?.tag ?? 'none'}> nhưng gặp </${tagName}>`,
        );
        continue;
      }
      stack.pop();
      node.end = start + raw.length;
      node.textContent = scene.slice(node.start, node.end);
      continue;
    }

    const parsed = parseOpeningTag(raw);
    errors.push(...parsed.errors.map((error) => `${tagName}: ${error}`));
    const parent = stack.at(-1) ?? null;
    const node: TParsedNode = {
      tag: tagName,
      attributes: parsed.attributes,
      start,
      end: start + raw.length,
      parent,
      children: [],
      textContent: raw,
    };
    parent?.children.push(node);
    if (!parent) roots.push(node);
    if (!raw.endsWith('/>')) stack.push(node);
  }

  for (let index = 0; index < scene.length; index += 1) {
    if (scene[index] !== '<') continue;
    if (!tagRanges.some((range) => range.start === index)) {
      errors.push(`XML có markup không được hỗ trợ tại offset ${index}`);
    }
  }
  for (const node of stack) {
    errors.push(`XML thiếu closing tag </${node.tag}>`);
  }
  if (roots.length !== 1 || roots[0]?.tag !== 'svg') {
    errors.push('XML phải có đúng một root <svg>');
  }

  return { roots, errors };
};

const flatten = (roots: readonly TParsedNode[]): TParsedNode[] => {
  const result: TParsedNode[] = [];
  const visit = (node: TParsedNode): void => {
    result.push(node);
    for (const child of node.children) visit(child);
  };
  for (const root of roots) visit(root);
  return result;
};

const numericAttribute = (node: TParsedNode, name: string): number =>
  Number(node.attributes[name]);

const parseColor = (value: string | undefined): TColor | null => {
  if (!value || value === 'none' || value === 'transparent') return null;
  const hexMatch = HEX_COLOR_PATTERN.exec(value);
  const rgbMatch = RGB_COLOR_PATTERN.exec(value);
  const channels = hexMatch?.[1]
    ? [
        Number.parseInt(hexMatch[1].slice(0, 2), 16),
        Number.parseInt(hexMatch[1].slice(2, 4), 16),
        Number.parseInt(hexMatch[1].slice(4, 6), 16),
      ]
    : rgbMatch
      ? [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
      : null;
  if (!channels || channels.some((channel) => channel < 0 || channel > 255)) {
    return null;
  }
  const [red = 0, green = 0, blue = 0] = channels;
  return {
    red,
    green,
    blue,
    hex: `#${channels
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase(),
  };
};

const colorFromComposite = (color: TComposite): TColor => {
  const channels = [color.red, color.green, color.blue].map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel))),
  );
  const [red = 0, green = 0, blue = 0] = channels;
  return {
    red,
    green,
    blue,
    hex: `#${channels
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase(),
  };
};

const linearChannel = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (color: TColor): number =>
  linearChannel(color.red) * 0.2126 +
  linearChannel(color.green) * 0.7152 +
  linearChannel(color.blue) * 0.0722;

const contrast = (foreground: TColor, background: TColor): number => {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
};

const ancestorsInclusive = (node: TParsedNode): TParsedNode[] => {
  const result: TParsedNode[] = [];
  let current: TParsedNode | null = node;
  while (current) {
    result.push(current);
    current = current.parent;
  }
  return result;
};

const opacityProduct = (
  node: TParsedNode,
  name: 'fill-opacity' | 'opacity' | 'stroke-opacity',
): number =>
  ancestorsInclusive(node).reduce((product, current) => {
    const raw = current.attributes[name];
    if (raw === undefined) return product;
    const value = Number(raw);
    return Number.isFinite(value) ? product * value : 0;
  }, 1);

const isDisplayed = (node: TParsedNode): boolean =>
  ancestorsInclusive(node).every(
    (current) =>
      current.attributes.display !== 'none' &&
      current.attributes.visibility !== 'hidden' &&
      current.attributes.visibility !== 'collapse' &&
      !NON_RENDERED_ANCESTORS.has(current.tag),
  );

const effectiveAlpha = (node: TParsedNode, paint: 'fill' | 'stroke'): number =>
  isDisplayed(node)
    ? Math.max(
        0,
        Math.min(
          1,
          opacityProduct(node, 'opacity') *
            opacityProduct(
              node,
              paint === 'fill' ? 'fill-opacity' : 'stroke-opacity',
            ),
        ),
      )
    : 0;

const hiddenPaintReason = (
  node: TParsedNode,
  paint: 'fill' | 'stroke',
): string => {
  const ancestors = ancestorsInclusive(node);
  if (ancestors.some((current) => current.attributes.display === 'none')) {
    return 'display=none';
  }
  if (
    ancestors.some(
      (current) =>
        current.attributes.visibility === 'hidden' ||
        current.attributes.visibility === 'collapse',
    )
  ) {
    return 'visibility';
  }
  if (opacityProduct(node, 'opacity') <= 0) return 'opacity=0';
  if (
    opacityProduct(
      node,
      paint === 'fill' ? 'fill-opacity' : 'stroke-opacity',
    ) <= 0
  ) {
    return `${paint}-opacity=0`;
  }
  return 'opacity hoặc visibility';
};

const shapeRect = (node: TParsedNode): TRect | null => {
  if (node.tag === 'rect') {
    const rect = {
      x: numericAttribute(node, 'x'),
      y: numericAttribute(node, 'y'),
      width: numericAttribute(node, 'width'),
      height: numericAttribute(node, 'height'),
    };
    return Object.values(rect).every(Number.isFinite) &&
      rect.width > 0 &&
      rect.height > 0
      ? rect
      : null;
  }
  if (node.tag === 'circle') {
    const cx = numericAttribute(node, 'cx');
    const cy = numericAttribute(node, 'cy');
    const radius = numericAttribute(node, 'r');
    return [cx, cy, radius].every(Number.isFinite) && radius > 0
      ? {
          x: cx - radius,
          y: cy - radius,
          width: radius * 2,
          height: radius * 2,
        }
      : null;
  }
  if (node.tag === 'ellipse') {
    const cx = numericAttribute(node, 'cx');
    const cy = numericAttribute(node, 'cy');
    const rx = numericAttribute(node, 'rx');
    const ry = numericAttribute(node, 'ry');
    return [cx, cy, rx, ry].every(Number.isFinite) && rx > 0 && ry > 0
      ? { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
      : null;
  }
  return null;
};

const containsPoint = (rect: TRect, x: number, y: number): boolean =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y &&
  y <= rect.y + rect.height;

const visibleShape = (node: TParsedNode): boolean => {
  if (!SHAPE_TAGS.has(node.tag) || !shapeRect(node)) return false;
  const fill = parseColor(node.attributes.fill ?? '#000000');
  const stroke = parseColor(node.attributes.stroke);
  return (
    (fill !== null && effectiveAlpha(node, 'fill') > 0) ||
    (stroke !== null && effectiveAlpha(node, 'stroke') > 0)
  );
};

const compositeOver = (
  source: TColor,
  sourceAlpha: number,
  destination: TComposite,
): TComposite => {
  const alpha = sourceAlpha + destination.alpha * (1 - sourceAlpha);
  if (alpha <= 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
  return {
    red:
      (source.red * sourceAlpha +
        destination.red * destination.alpha * (1 - sourceAlpha)) /
      alpha,
    green:
      (source.green * sourceAlpha +
        destination.green * destination.alpha * (1 - sourceAlpha)) /
      alpha,
    blue:
      (source.blue * sourceAlpha +
        destination.blue * destination.alpha * (1 - sourceAlpha)) /
      alpha,
    alpha,
  };
};

const backgroundAt = (
  nodes: readonly TParsedNode[],
  before: number,
  x: number,
  y: number,
): TColor | null => {
  let composite: TComposite = { red: 0, green: 0, blue: 0, alpha: 0 };
  for (const node of nodes) {
    if (node.start >= before || !SHAPE_TAGS.has(node.tag)) continue;
    const rect = shapeRect(node);
    const fill = parseColor(node.attributes.fill ?? '#000000');
    const alpha = effectiveAlpha(node, 'fill');
    if (!rect || !fill || alpha <= 0 || !containsPoint(rect, x, y)) continue;
    composite = compositeOver(fill, alpha, composite);
  }
  return composite.alpha > 0 ? colorFromComposite(composite) : null;
};

const visualShapeNodes = (node: TParsedNode): TParsedNode[] =>
  [node, ...flatten(node.children)].filter(visibleShape).sort((left, right) => {
    const leftRect = shapeRect(left);
    const rightRect = shapeRect(right);
    const leftArea = leftRect ? leftRect.width * leftRect.height : -1;
    const rightArea = rightRect ? rightRect.width * rightRect.height : -1;
    return rightArea - leftArea;
  });

const nodeRect = (node: TParsedNode): TRect | null => {
  const visual = visualShapeNodes(node)[0];
  return visual ? shapeRect(visual) : null;
};

const sceneCode = (roots: readonly TParsedNode[]): string =>
  roots.find((root) => root.tag === 'svg')?.attributes['data-screen-code'] ??
  'MH-UNKNOWN';

const ownerComponent = (node: TParsedNode): string => {
  let current: TParsedNode | null = node;
  while (current) {
    const componentId = current.attributes['data-component-id'];
    if (componentId) return componentId;
    current = current.parent;
  }
  return 'scene';
};

const ancestorAttribute = (
  node: TParsedNode,
  name: string,
): string | undefined => {
  let current: TParsedNode | null = node;
  while (current) {
    const value = current.attributes[name];
    if (value !== undefined) return value;
    current = current.parent;
  }
  return undefined;
};

const visibleText = (node: TParsedNode): string =>
  node.textContent
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos);/gu, 'x')
    .replace(/\s+/gu, ' ')
    .trim();

const context = (code: string, node: TParsedNode): string =>
  `${code}/${ownerComponent(node)}`;

const textRole = (node: TParsedNode): 'annotation' | 'body' => {
  const explicit = node.attributes['data-text-role'];
  if (
    explicit === 'annotation' ||
    explicit === 'label' ||
    explicit === 'status' ||
    explicit === 'placeholder'
  ) {
    return 'annotation';
  }
  const primitive = node.attributes['data-primitive'];
  if (
    primitive === 'label-text' ||
    primitive === 'helper-text' ||
    primitive === 'status-text'
  ) {
    return 'annotation';
  }
  const layer = ancestorAttribute(node, 'data-layer');
  return layer === 'directory' ||
    layer === 'states' ||
    layer === 'markers' ||
    layer === 'warning'
    ? 'annotation'
    : 'body';
};

const parseViewBox = (roots: readonly TParsedNode[]): TRect | null => {
  const values = roots[0]?.attributes.viewBox
    ?.trim()
    .split(/[\s,]+/u)
    .map(Number);
  if (values?.length !== 4 || !values.every(Number.isFinite)) {
    return null;
  }
  const [x = 0, y = 0, width = 0, height = 0] = values;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
};

const auditTextBounds = (
  node: TParsedNode,
  viewBox: TRect | null,
  owner: string,
): string[] => {
  if (!viewBox) return [`${owner}: viewBox không hợp lệ`];
  const tspans = flatten(node.children).filter(
    (candidate) => candidate.tag === 'tspan',
  );
  const lines = tspans.length > 0 ? tspans : [node];
  let baseline = numericAttribute(node, 'y');
  let currentX = numericAttribute(node, 'x');
  const errors: string[] = [];
  lines.forEach((line, index) => {
    const explicitX = numericAttribute(line, 'x');
    const explicitY = numericAttribute(line, 'y');
    const dy = numericAttribute(line, 'dy');
    if (Number.isFinite(explicitX)) currentX = explicitX;
    if (Number.isFinite(explicitY)) baseline = explicitY;
    else if (Number.isFinite(dy)) baseline += dy;
    const fontSizeValue = Number(
      line.attributes['font-size'] ?? ancestorAttribute(line, 'font-size'),
    );
    const text = visibleText(line);
    if (
      !Number.isFinite(currentX) ||
      !Number.isFinite(baseline) ||
      !Number.isFinite(fontSizeValue)
    ) {
      errors.push(`${owner}: hình học văn bản dòng ${index + 1} không hợp lệ`);
      return;
    }
    const width = Array.from(text).length * fontSizeValue * 0.48;
    const anchor =
      line.attributes['text-anchor'] ??
      ancestorAttribute(line, 'text-anchor') ??
      'start';
    const left =
      anchor === 'middle'
        ? currentX - width / 2
        : anchor === 'end'
          ? currentX - width
          : currentX;
    const right = left + width;
    const top = baseline - fontSizeValue * 0.82;
    const bottom = baseline + fontSizeValue * 0.25;
    const tolerance = 1;
    if (
      left < viewBox.x - tolerance ||
      right > viewBox.x + viewBox.width + tolerance ||
      top < viewBox.y - tolerance ||
      bottom > viewBox.y + viewBox.height + tolerance
    ) {
      errors.push(
        `${owner}: văn bản dòng ${index + 1} vượt khung viewBox (${left.toFixed(1)},${top.toFixed(1)}–${right.toFixed(1)},${bottom.toFixed(1)})`,
      );
    }
  });
  return errors;
};

const auditText = (
  node: TParsedNode,
  nodes: readonly TParsedNode[],
  code: string,
  viewBox: TRect | null,
): string[] => {
  const errors: string[] = [];
  const owner = context(code, node);
  const fontSize = numericAttribute(node, 'font-size');
  const minimum = textRole(node) === 'annotation' ? 14 : 16;
  if (!Number.isFinite(fontSize) || fontSize < minimum) {
    errors.push(`${owner}: cỡ chữ ${String(fontSize)}px nhỏ hơn ${minimum}px`);
  }

  const alpha = effectiveAlpha(node, 'fill');
  const foreground = parseColor(node.attributes.fill);
  const x = numericAttribute(node, 'x');
  const y = numericAttribute(node, 'y');
  const background =
    Number.isFinite(x) && Number.isFinite(y)
      ? backgroundAt(nodes, node.start, x, y)
      : null;
  if (alpha <= 0) {
    errors.push(
      `${owner}: văn bản không hiển thị do ${hiddenPaintReason(node, 'fill')}`,
    );
  } else if (!foreground || !background) {
    errors.push(`${owner}: màu văn bản không được phân giải từ SVG cuối cùng`);
  } else {
    const effectiveForeground = colorFromComposite(
      compositeOver(foreground, alpha, {
        red: background.red,
        green: background.green,
        blue: background.blue,
        alpha: 1,
      }),
    );
    const ratio = contrast(effectiveForeground, background);
    if (ratio < 4.5) {
      errors.push(
        `${owner}: tương phản văn bản ${effectiveForeground.hex}/${background.hex} = ${ratio.toFixed(2)} < 4.50`,
      );
    }
  }
  if (visibleText(node).length === 0) {
    errors.push(`${owner}: văn bản hiển thị trống`);
  }
  errors.push(...auditTextBounds(node, viewBox, owner));
  return errors;
};

const auditControl = (
  node: TParsedNode,
  nodes: readonly TParsedNode[],
  code: string,
  requireContrast: boolean,
): string[] => {
  const errors: string[] = [];
  const rect = nodeRect(node);
  const owner = context(code, node);
  if (!rect) return [`${owner}: hình học control không hợp lệ`];
  if (rect.width < 44 || rect.height < 44) {
    errors.push(
      `${owner}: control ${rect.width}×${rect.height} nhỏ hơn 44×44 logical px`,
    );
  }
  if (requireContrast) {
    const visual = [node, ...flatten(node.children)].find(visibleShape);
    const visualRect = visual ? shapeRect(visual) : null;
    const foreground = visual
      ? (parseColor(visual.attributes.stroke) ??
        parseColor(visual.attributes.fill ?? '#000000'))
      : null;
    const outsideX = visualRect
      ? visualRect.x > 0
        ? visualRect.x - 1
        : visualRect.x + visualRect.width + 1
      : 0;
    const outsideY = visualRect ? visualRect.y + visualRect.height / 2 : 0;
    const background = visual
      ? backgroundAt(nodes, visual.start, outsideX, outsideY)
      : null;
    if (!foreground || !background) {
      errors.push(
        `${owner}: màu control không được phân giải từ SVG cuối cùng`,
      );
    } else {
      const ratio = contrast(foreground, background);
      if (ratio < 3) {
        errors.push(
          `${owner}: control ${foreground.hex}/${background.hex} = ${ratio.toFixed(2)} < 3.00`,
        );
      }
    }
  }
  return errors;
};

const auditFocus = (
  node: TParsedNode,
  nodes: readonly TParsedNode[],
  code: string,
): string[] => {
  const errors: string[] = [];
  const owner = context(code, node);
  const rect = nodeRect(node);
  if (!rect) return [`${owner}: hình học focus không hợp lệ`];
  const stroke = parseColor(node.attributes.stroke);
  const strokeWidth = numericAttribute(node, 'stroke-width');
  const outsideX = rect.x > 0 ? rect.x - 1 : rect.x + rect.width + 1;
  const outsideY = rect.y + rect.height / 2;
  const background = backgroundAt(nodes, node.start, outsideX, outsideY);
  if (effectiveAlpha(node, 'stroke') <= 0) {
    errors.push(`${owner}: focus không hiển thị do opacity hoặc visibility`);
  } else if (!stroke || !background) {
    errors.push(`${owner}: màu focus không được phân giải từ SVG cuối cùng`);
  } else {
    const ratio = contrast(stroke, background);
    if (ratio < 3) {
      errors.push(
        `${owner}: focus ${stroke.hex}/${background.hex} = ${ratio.toFixed(2)} < 3.00`,
      );
    }
  }
  if (!Number.isFinite(strokeWidth) || strokeWidth < 2) {
    errors.push(`${owner}: focus phải dày tối thiểu 2px`);
  }
  return errors;
};

const auditStatus = (node: TParsedNode, code: string): string[] => {
  const hasVisibleText = flatten(node.children).some(
    (child) =>
      child.tag === 'text' &&
      visibleText(child).length > 0 &&
      effectiveAlpha(child, 'fill') > 0,
  );
  return hasVisibleText
    ? []
    : [`${context(code, node)}: trạng thái màu phải có văn bản hiển thị`];
};

const auditOpacityValues = (node: TParsedNode, code: string): string[] => {
  const errors: string[] = [];
  for (const name of ['fill-opacity', 'opacity', 'stroke-opacity'] as const) {
    const raw = node.attributes[name];
    if (raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors.push(`${context(code, node)}: ${name} phải là số từ 0 đến 1`);
    }
  }
  return errors;
};

const uniqueErrors = (errors: readonly string[]): string[] => [
  ...new Set(errors),
];

export const auditSceneAccessibility = (scene: string): string[] => {
  const parsed = parseScene(scene);
  const parseErrors = uniqueErrors(parsed.errors);
  if (parseErrors.length > 0) return parseErrors;
  const nodes = flatten(parsed.roots);
  const code = sceneCode(parsed.roots);
  const viewBox = parseViewBox(parsed.roots);
  const errors: string[] = [];

  for (const node of nodes) {
    errors.push(...auditOpacityValues(node, code));
    if (node.tag === 'text') {
      errors.push(...auditText(node, nodes, code, viewBox));
    }

    const explicitControl = node.attributes['data-a11y-kind'] === 'control';
    const componentControl =
      node.attributes['data-component-id'] !== undefined &&
      ['field', 'action', 'navigation'].includes(
        node.attributes['data-visual-role'] ??
          node.attributes['data-semantic-role'] ??
          '',
      );
    const contractButton =
      node.tag === 'g' &&
      ownerComponent(node) === 'scene' &&
      /^(?:primary|secondary|destructive)-button$/u.test(
        node.attributes['data-primitive'] ?? '',
      );
    if (explicitControl || componentControl || contractButton) {
      errors.push(...auditControl(node, nodes, code, explicitControl));
    }

    if (node.attributes['data-a11y-kind'] === 'focus') {
      errors.push(...auditFocus(node, nodes, code));
    }
    if (
      node.attributes['data-status'] !== undefined ||
      node.attributes['data-screen-state'] !== undefined
    ) {
      errors.push(...auditStatus(node, code));
    }
  }

  return uniqueErrors(errors);
};
