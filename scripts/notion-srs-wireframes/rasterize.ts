import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  copyFile,
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import {
  PLUS_JAKARTA_BASE64,
  PLUS_JAKARTA_FONT_FACE_CSS,
  PLUS_JAKARTA_FONT_FAMILY,
} from './font.ts';
import { readPngMetadata } from './png-metadata.ts';

const OUTPUT_WIDTH = 3840;
const OUTPUT_HEIGHT = 2880;
const MAX_SVG_BYTES = 16 * 1024 * 1024;
const MAX_PNG_BYTES = 5 * 1024 * 1024;

const RSVG_CONVERT_CANDIDATES = Object.freeze([
  '/opt/homebrew/bin/rsvg-convert',
  '/usr/local/bin/rsvg-convert',
  '/usr/bin/rsvg-convert',
  '/opt/local/bin/rsvg-convert',
]);
const MAGICK_CANDIDATES = Object.freeze([
  '/opt/homebrew/bin/magick',
  '/usr/local/bin/magick',
  '/usr/bin/magick',
  '/opt/local/bin/magick',
]);

const runFile = (
  executable: string,
  arguments_: readonly string[],
): Promise<void> =>
  new Promise((resolvePromise, rejectPromise) => {
    execFile(
      executable,
      [...arguments_],
      {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        timeout: 120_000,
        windowsHide: true,
      },
      (error) => {
        if (error) {
          rejectPromise(
            new Error(`Raster tool thất bại: ${basename(executable)}`, {
              cause: error,
            }),
          );
          return;
        }
        resolvePromise();
      },
    );
  });

const resolveExecutable = async (
  label: string,
  candidates: readonly string[],
): Promise<string> => {
  for (const candidate of candidates) {
    if (!isAbsolute(candidate)) continue;
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next fixed absolute installation path.
    }
  }
  throw new Error(`Không tìm thấy binary tuyệt đối an toàn cho ${label}`);
};

const normalizeFontFamily = (value: string): string => {
  const normalized = value.trim();
  const quote = normalized[0];
  if (
    (quote === "'" || quote === '"') &&
    normalized.at(-1) === quote &&
    normalized.length >= 2
  ) {
    return normalized.slice(1, -1);
  }
  return normalized;
};

const assertFontElementParents = (
  svg: string,
  defsIndex: number,
  styleIndex: number,
): void => {
  const stack: string[] = [];
  const tags = [...svg.matchAll(/<\/?([A-Za-z][A-Za-z0-9:.-]*)\b[^>]*>/gu)];
  let rootOpened = false;
  let rootClosed = false;
  for (const tag of tags) {
    const index = tag.index;
    const source = tag[0];
    const name = tag[1]?.toLocaleLowerCase('en-US');
    if (index === undefined || !name) {
      throw new Error('SVG không an toàn: tag XML không xác định');
    }
    if (source.startsWith('</')) {
      if (stack.pop() !== name) {
        throw new Error('SVG không an toàn: thứ tự đóng tag XML không hợp lệ');
      }
      if (name === 'svg') {
        if (stack.length !== 0 || !rootOpened || rootClosed) {
          throw new Error('SVG không an toàn: root svg đóng sai cấu trúc');
        }
        rootClosed = true;
      }
      continue;
    }
    if (name === 'svg') {
      if (rootOpened || rootClosed || stack.length !== 0) {
        throw new Error('SVG không an toàn: chỉ cho phép đúng một root svg');
      }
      rootOpened = true;
    } else if (!rootOpened || rootClosed || stack.length === 0) {
      throw new Error('SVG không an toàn: element nằm ngoài root svg');
    }
    if (index === defsIndex && !(stack.length === 1 && stack[0] === 'svg')) {
      throw new Error(
        'SVG không an toàn: defs chứa font phải là child của svg',
      );
    }
    if (
      index === styleIndex &&
      !(stack.length === 2 && stack[0] === 'svg' && stack[1] === 'defs')
    ) {
      throw new Error('SVG không an toàn: style font phải là child của defs');
    }
    if (!/\/\s*>$/u.test(source)) stack.push(name);
  }
  if (stack.length !== 0 || !rootOpened || !rootClosed) {
    throw new Error('SVG không an toàn: cấu trúc tag XML chưa đóng hoàn chỉnh');
  }
};

const assertPinnedFontUsage = (svg: string): void => {
  if (/<!--|-->|\/\*|\*\//u.test(svg)) {
    throw new Error(
      'SVG không an toàn: XML/CSS comment có thể che giấu cấu hình font',
    );
  }
  if (
    /<(?:desc|metadata)\b[^>]*>[\s\S]*?(?:@font-face|data:font\/|<style\b)[\s\S]*?<\/(?:desc|metadata)>/iu.test(
      svg,
    )
  ) {
    throw new Error(
      'SVG không an toàn: metadata mô tả không được chứa cấu hình font/style',
    );
  }

  const defsOpen = [...svg.matchAll(/<defs\b[^>]*>/giu)];
  const defsClose = [...svg.matchAll(/<\/defs\s*>/giu)];
  const styleOpen = [...svg.matchAll(/<style\b[^>]*>/giu)];
  const styleClose = [...svg.matchAll(/<\/style\s*>/giu)];
  if (
    defsOpen.length !== 1 ||
    defsClose.length !== 1 ||
    styleOpen.length !== 1 ||
    styleClose.length !== 1
  ) {
    throw new Error(
      'SVG không an toàn: cần đúng một defs và một style font active',
    );
  }
  const defsOpenMatch = defsOpen[0];
  const defsCloseMatch = defsClose[0];
  const styleOpenMatch = styleOpen[0];
  const styleCloseMatch = styleClose[0];
  if (
    !defsOpenMatch ||
    !defsCloseMatch ||
    !styleOpenMatch ||
    !styleCloseMatch ||
    defsOpenMatch.index === undefined ||
    defsCloseMatch.index === undefined ||
    styleOpenMatch.index === undefined ||
    styleCloseMatch.index === undefined ||
    !/^<style\s*>$/iu.test(styleOpenMatch[0]) ||
    /\sstyle\s*=/iu.test(svg)
  ) {
    throw new Error('SVG không an toàn: style có thuộc tính hoặc sai cấu trúc');
  }
  assertFontElementParents(svg, defsOpenMatch.index, styleOpenMatch.index);
  const defsContentStart = defsOpenMatch.index + defsOpenMatch[0].length;
  const styleContentStart = styleOpenMatch.index + styleOpenMatch[0].length;
  if (
    styleOpenMatch.index < defsContentStart ||
    styleCloseMatch.index <= styleContentStart ||
    defsCloseMatch.index < styleCloseMatch.index + styleCloseMatch[0].length ||
    svg.slice(defsContentStart, styleOpenMatch.index).trim().length !== 0
  ) {
    throw new Error(
      'SVG không an toàn: style phải là child trực tiếp đầu tiên của defs',
    );
  }
  const styleContent = svg
    .slice(styleContentStart, styleCloseMatch.index)
    .trim();
  const globalTextRule = `text{font-family:'${PLUS_JAKARTA_FONT_FAMILY}'}`;
  if (
    !styleContent.startsWith(PLUS_JAKARTA_FONT_FACE_CSS) ||
    styleContent.slice(PLUS_JAKARTA_FONT_FACE_CSS.length).trim() !==
      globalTextRule
  ) {
    throw new Error(
      'SVG không an toàn: style chỉ được chứa font pin và global text rule',
    );
  }

  const embeddedFontPayloads = [
    ...svg.matchAll(/data:font\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/giu),
  ].map((match) => match[0]);
  const expectedFontPayload = `data:font/ttf;base64,${PLUS_JAKARTA_BASE64}`;
  if (
    embeddedFontPayloads.length !== 1 ||
    embeddedFontPayloads[0] !== expectedFontPayload
  ) {
    throw new Error(
      'SVG không an toàn: phải nhúng đúng một font Plus Jakarta Sans đã pin',
    );
  }

  const cssFamilies = [...svg.matchAll(/\bfont-family\s*:\s*([^;}]+)/giu)].map(
    (match) => match[1] ?? '',
  );
  const attributeFamilies = [
    ...svg.matchAll(/\bfont-family\s*=\s*(["'])(.*?)\1/giu),
  ].map((match) => match[2] ?? '');
  const activeFamilies = [...cssFamilies, ...attributeFamilies];
  if (
    activeFamilies.length === 0 ||
    activeFamilies.some(
      (family) => normalizeFontFamily(family) !== PLUS_JAKARTA_FONT_FAMILY,
    ) ||
    /\bfont\s*:/iu.test(svg)
  ) {
    throw new Error(
      'SVG không an toàn: font fallback hoặc font override không được phép',
    );
  }
};

const assertSafeSvg = (svg: string): void => {
  if (
    typeof svg !== 'string' ||
    svg.length === 0 ||
    Buffer.byteLength(svg, 'utf8') > MAX_SVG_BYTES ||
    svg.includes('\0')
  ) {
    throw new Error(
      'SVG không an toàn: dữ liệu trống, quá lớn hoặc sai định dạng',
    );
  }
  const root = svg.match(/^\s*<svg\b[^>]*>/iu)?.[0];
  if (!root || !/<\/svg>\s*$/iu.test(svg)) {
    throw new Error('SVG không an toàn: thiếu phần tử gốc hoàn chỉnh');
  }
  if (!/\bviewBox\s*=\s*["']0 0 1920 1440["']/u.test(root)) {
    throw new Error('SVG không an toàn: viewBox master phải là 1920x1440');
  }
  assertPinnedFontUsage(svg);

  const forbiddenMarkup =
    /<!DOCTYPE\b|<!ENTITY\b|<\?(?:xml-stylesheet)|<(?:script|foreignObject|iframe|object|embed|image|feImage|audio|video|link|animate|set)\b/iu;
  const forbiddenCode =
    /\s(?:on[a-z0-9:_-]+|xml:base)\s*=|\b(?:javascript|vbscript):|@import\b|expression\s*\(/iu;
  if (forbiddenMarkup.test(svg) || forbiddenCode.test(svg)) {
    throw new Error('SVG không an toàn: có markup hoặc mã thực thi bị cấm');
  }

  for (const match of svg.matchAll(
    /\b(?:href|xlink:href|src)\s*=\s*(["'])(.*?)\1/giu,
  )) {
    const reference = match[2]?.trim() ?? '';
    if (
      !reference.startsWith('#') &&
      !reference.startsWith('data:font/ttf;base64,')
    ) {
      throw new Error('SVG không an toàn: tham chiếu tài nguyên ngoài');
    }
  }

  for (const match of svg.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/giu)) {
    const reference = match[2]?.trim() ?? '';
    if (
      !reference.startsWith('#') &&
      !reference.startsWith('data:font/ttf;base64,')
    ) {
      throw new Error('SVG không an toàn: CSS URL ngoài');
    }
  }

  const withoutCanonicalNamespace = svg
    .replaceAll('http://www.w3.org/2000/svg', '')
    .replaceAll('http:&#47;&#47;www.w3.org/2000/svg', '');
  if (
    /\b(?:https?|ftp|file):|(^|["'(=\s])\/\//iu.test(withoutCanonicalNamespace)
  ) {
    throw new Error('SVG không an toàn: protocol ngoài');
  }
};

const resolveOutputPath = async (outputPath: string): Promise<string> => {
  if (
    typeof outputPath !== 'string' ||
    outputPath.length === 0 ||
    outputPath.includes('\0')
  ) {
    throw new Error('Đường dẫn PNG đầu ra không hợp lệ');
  }
  const absoluteOutput = resolve(outputPath);
  if (
    extname(absoluteOutput) !== '.png' ||
    basename(absoluteOutput) === '.png'
  ) {
    throw new Error('Đường dẫn đầu ra phải là tệp .png');
  }
  const parent = dirname(absoluteOutput);
  const parentStat = await lstat(parent);
  if (!parentStat.isDirectory()) {
    throw new Error('Thư mục đầu ra không hợp lệ');
  }
  try {
    const destinationStat = await lstat(absoluteOutput);
    if (!destinationStat.isFile()) {
      throw new Error('Đích PNG hiện có không phải tệp thường');
    }
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
  return absoluteOutput;
};

const assertNormalizedPng = (png: Buffer): void => {
  if (png.length >= MAX_PNG_BYTES) {
    throw new Error('PNG chuẩn hóa vượt giới hạn 5 MiB');
  }
  const metadata = readPngMetadata(png);
  if (
    metadata.width !== OUTPUT_WIDTH ||
    metadata.height !== OUTPUT_HEIGHT ||
    metadata.bitDepth !== 8 ||
    metadata.colorType !== 2 ||
    !metadata.opaque
  ) {
    throw new Error('PNG chuẩn hóa không phải RGB8 opaque 3840x2880');
  }
};

export const rasterizeSvg = async (
  svg: string,
  outputPath: string,
): Promise<void> => {
  assertSafeSvg(svg);
  const absoluteOutput = await resolveOutputPath(outputPath);
  const [rsvgConvert, magick] = await Promise.all([
    resolveExecutable('rsvg-convert', RSVG_CONVERT_CANDIDATES),
    resolveExecutable('ImageMagick', MAGICK_CANDIDATES),
  ]);
  const workDirectory = await mkdtemp(join(tmpdir(), 'notion-srs-raster-'));
  const masterPath = join(workDirectory, 'master.svg');
  const renderedPath = join(workDirectory, 'rendered.png');
  const normalizedPath = join(workDirectory, 'normalized.png');
  const stagingOutput = join(
    dirname(absoluteOutput),
    `.${basename(absoluteOutput)}.${randomUUID()}.tmp`,
  );
  let stagingCreated = false;

  try {
    await writeFile(masterPath, svg, { encoding: 'utf8', flag: 'wx' });
    await runFile(rsvgConvert, [
      '--width',
      String(OUTPUT_WIDTH),
      '--height',
      String(OUTPUT_HEIGHT),
      '--format',
      'png',
      '--output',
      renderedPath,
      masterPath,
    ]);
    await runFile(magick, [
      renderedPath,
      '-alpha',
      'remove',
      '-alpha',
      'off',
      '-strip',
      '-define',
      'png:compression-level=9',
      `PNG24:${normalizedPath}`,
    ]);
    const normalized = await readFile(normalizedPath);
    assertNormalizedPng(normalized);
    await copyFile(normalizedPath, stagingOutput, constants.COPYFILE_EXCL);
    stagingCreated = true;
    await rename(stagingOutput, absoluteOutput);
    stagingCreated = false;
  } finally {
    if (stagingCreated) await rm(stagingOutput, { force: true });
    await rm(workDirectory, { force: true, recursive: true });
  }
};
