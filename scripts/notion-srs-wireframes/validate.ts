import type { Dirent } from 'node:fs';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  MOCKUP_TARGETS,
  UI_WIREFRAME_PAGES,
  WIREFRAME_TARGETS,
} from './manifest.ts';
import { readPngMetadata } from './png-metadata.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';
import type { TLayoutRecipe, TScreenVisualTarget } from './types.ts';

const MAX_PNG_BYTES = 5 * 1024 * 1024;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const CONTACT_SHEET_WIREFRAMES = 'contact-sheet-wireframes.html';
const CONTACT_SHEET_MOCKUPS = 'contact-sheet-mockups.html';
const RECIPE_LABELS = Object.freeze({
  dashboard: 'tổng quan',
  form: 'biểu mẫu',
  list: 'danh sách',
  detail: 'chi tiết',
  composer: 'trình soạn nội dung',
  viewer: 'trình xem',
  evidence: 'bằng chứng',
  reconciliation: 'đối soát',
} as const satisfies Readonly<Record<TLayoutRecipe, string>>);

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const expectedPngPaths = [
  ...WIREFRAME_TARGETS.map(
    (target) => `wireframes/${target.filename}` as const,
  ),
  ...MOCKUP_TARGETS.map((target) => `mockups/${target.filename}` as const),
] as const;

const EXPECTED_FILES = new Set([
  ...expectedPngPaths,
  CONTACT_SHEET_WIREFRAMES,
  CONTACT_SHEET_MOCKUPS,
]);
const EXPECTED_DIRECTORIES = new Set(['wireframes', 'mockups']);

const normalizeRelativePath = (value: string): string =>
  sep === '/' ? value : value.split(sep).join('/');

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const walkGeneratedOutput = async (
  outputRoot: string,
): Promise<
  Readonly<{ files: readonly string[]; errors: readonly string[] }>
> => {
  const files: string[] = [];
  const errors: string[] = [];

  const visit = async (directory: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      errors.push(
        `${normalizeRelativePath(relative(outputRoot, directory)) || '.'}: không đọc được thư mục (${describeError(error)})`,
      );
      return;
    }
    for (const entry of entries) {
      const pathname = join(directory, entry.name);
      const relativePath = normalizeRelativePath(
        relative(outputRoot, pathname),
      );
      if (entry.isSymbolicLink()) {
        errors.push(`${relativePath}: symbolic link không được phép`);
      } else if (entry.isDirectory()) {
        if (!EXPECTED_DIRECTORIES.has(relativePath)) {
          errors.push(`${relativePath}: unexpected generated directory`);
        }
        await visit(pathname);
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        errors.push(`${relativePath}: generated output không phải tệp thường`);
      }
    }
  };

  try {
    const root = await lstat(outputRoot);
    if (!root.isDirectory() || root.isSymbolicLink()) {
      return Object.freeze({
        files: Object.freeze([]),
        errors: Object.freeze([
          `${outputRoot}: output không phải thư mục thường`,
        ]),
      });
    }
  } catch (error) {
    return Object.freeze({
      files: Object.freeze([]),
      errors: Object.freeze([
        `${outputRoot}: không đọc được output directory (${describeError(error)})`,
      ]),
    });
  }

  await visit(outputRoot);
  return Object.freeze({
    files: Object.freeze(files.sort()),
    errors: Object.freeze(errors),
  });
};

const validatePng = async (
  outputRoot: string,
  directory: 'wireframes' | 'mockups',
  target: TScreenVisualTarget,
): Promise<string[]> => {
  const errors: string[] = [];
  const relativePath = `${directory}/${target.filename}`;
  const pathname = join(outputRoot, directory, target.filename);
  let bytes: Buffer;
  try {
    const metadata = await lstat(pathname);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      return [`${relativePath}: PNG không phải tệp thường`];
    }
    if (metadata.size >= MAX_PNG_BYTES) {
      errors.push(
        `${relativePath}: PNG phải nhỏ hơn 5 MiB (${metadata.size} bytes)`,
      );
    }
    bytes = await readFile(pathname);
  } catch (error) {
    return [
      `${relativePath}: thiếu hoặc không đọc được (${describeError(error)})`,
    ];
  }

  try {
    const metadata = readPngMetadata(bytes);
    if (
      metadata.width !== 3840 ||
      metadata.height !== 2880 ||
      metadata.bitDepth !== 8 ||
      metadata.colorType !== 2 ||
      !metadata.opaque
    ) {
      errors.push(
        `${relativePath}: phải là PNG opaque RGB8 3840×2880, nhận ${metadata.width}×${metadata.height} depth=${metadata.bitDepth} colorType=${metadata.colorType} opaque=${metadata.opaque}`,
      );
    }
  } catch (error) {
    errors.push(`${relativePath}: PNG không hợp lệ (${describeError(error)})`);
  }
  return errors;
};

const count = (value: string, pattern: RegExp): number =>
  value.match(pattern)?.length ?? 0;

const stripHtmlComments = (html: string): string =>
  html.replaceAll(/<!--[\s\S]*?-->/gu, '');

const readAttribute = (tag: string, name: string): string | null => {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'iu'),
  );
  return match?.[2] ?? null;
};

type THtmlBlock = Readonly<{
  attributes: string;
  body: string;
}>;

const extractBlocks = (
  html: string,
  tagName: 'article' | 'section',
): readonly THtmlBlock[] => {
  const pattern = new RegExp(
    `<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
    'giu',
  );
  return [...html.matchAll(pattern)].map((match) =>
    Object.freeze({
      attributes: match[1] ?? '',
      body: match[2] ?? '',
    }),
  );
};

const validateReviewControls = (filename: string, html: string): string[] => {
  const errors: string[] = [];
  if (
    !/<fieldset\b/iu.test(html) ||
    !/<legend\b[^>]*>[^<]+<\/legend>/iu.test(html)
  ) {
    errors.push(`${filename}: thiếu fieldset/legend cho chế độ duyệt`);
  }
  for (const value of ['fit', '100'] as const) {
    const pattern = new RegExp(
      `<input\\b(?=[^>]*\\btype=["']radio["'])(?=[^>]*\\bvalue=["']${value}["'])[^>]*>`,
      'iu',
    );
    if (!pattern.test(html)) {
      errors.push(`${filename}: thiếu radio review value=${value}`);
    }
  }
  if (!/Vừa chiều rộng|Khớp chiều rộng|Fit width/iu.test(html)) {
    errors.push(`${filename}: thiếu nhãn vừa chiều rộng`);
  }
  if (!/100%/u.test(html)) errors.push(`${filename}: thiếu nhãn 100%`);
  return errors;
};

const readContactSheet = async (
  outputRoot: string,
  filename: string,
): Promise<Readonly<{ html: string | null; errors: readonly string[] }>> => {
  try {
    const pathname = join(outputRoot, filename);
    const metadata = await lstat(pathname);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      return Object.freeze({
        html: null,
        errors: Object.freeze([`${filename}: không phải tệp thường`]),
      });
    }
    if (metadata.size >= MAX_HTML_BYTES) {
      return Object.freeze({
        html: null,
        errors: Object.freeze([
          `${filename}: HTML vượt giới hạn 2 MiB (${metadata.size} bytes)`,
        ]),
      });
    }
    return Object.freeze({
      html: await readFile(pathname, 'utf8'),
      errors: Object.freeze([]),
    });
  } catch (error) {
    return Object.freeze({
      html: null,
      errors: Object.freeze([
        `${filename}: thiếu hoặc không đọc được (${describeError(error)})`,
      ]),
    });
  }
};

const validateHtmlBase = (filename: string, html: string): string[] => {
  const errors = validateReviewControls(filename, html);
  if (/<!--[\s\S]*?-->/u.test(html)) {
    errors.push(`${filename}: HTML comment không được phép`);
  }
  if (!/<html\b[^>]*\blang=["']vi["']/iu.test(html)) {
    errors.push(`${filename}: phải khai báo lang="vi"`);
  }
  if (!/<meta\b[^>]*\bcharset=["']utf-8["']/iu.test(html)) {
    errors.push(`${filename}: phải khai báo charset="utf-8"`);
  }
  if (/<(?:object|embed|iframe|script)\b/iu.test(html)) {
    errors.push(`${filename}: không được nhúng object/embed/iframe/script`);
  }
  if (/\bon[a-z][a-z0-9:_-]*\s*=/iu.test(html)) {
    errors.push(`${filename}: inline event handler không được phép`);
  }
  if (/\.svg(?:[?#"'])/iu.test(html)) {
    errors.push(`${filename}: không được tham chiếu SVG`);
  }
  if (
    /\b(?:src|href|poster|action|formaction)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/iu.test(
      html,
    ) ||
    /\bsrcset\s*=\s*["'][^"']*(?:https?:|data:|javascript:|\/\/)/iu.test(
      html,
    ) ||
    /(?:@import\s+|url\(\s*["']?)\s*(?:https?:|data:|\/\/)/iu.test(html)
  ) {
    errors.push(`${filename}: chỉ được dùng tham chiếu asset tương đối cục bộ`);
  }
  return errors;
};

const validateTargetReferences = (
  filename: string,
  html: string,
  directory: 'wireframes' | 'mockups',
  targets: readonly TScreenVisualTarget[],
): string[] => {
  const errors: string[] = [];
  const expectedSources = new Set(
    targets.map((target) => `./${directory}/${target.filename}`),
  );
  const articleCards = extractBlocks(html, 'article');
  const imageTags = [...html.matchAll(/<img\b[^>]*>/giu)].map(
    (match) => match[0],
  );
  const actualSources = imageTags.map((tag) => readAttribute(tag, 'src') ?? '');
  if (actualSources.length !== targets.length) {
    errors.push(
      `${filename}: expected ${targets.length} PNG images, found ${actualSources.length}`,
    );
  }
  for (const source of actualSources) {
    if (!expectedSources.has(source)) {
      errors.push(`${filename}: unexpected PNG reference ${source}`);
    }
  }

  for (const target of targets) {
    const source = `./${directory}/${target.filename}`;
    if (
      actualSources.filter((candidate) => candidate === source).length !== 1
    ) {
      errors.push(`${filename}: cần đúng một tham chiếu ${source}`);
    }
    const screen = SCREEN_CONTRACTS.find(
      (candidate) => candidate.code === target.screenCode,
    );
    if (!screen) {
      errors.push(`${filename}: thiếu screen contract ${target.screenCode}`);
      continue;
    }
    const ownedCards = articleCards.filter(
      (card) =>
        readAttribute(card.attributes, 'data-screen-code') ===
        target.screenCode,
    );
    if (ownedCards.length !== 1) {
      errors.push(
        `${filename}: ${target.screenCode} cần đúng một article card, nhận ${ownedCards.length}`,
      );
      continue;
    }
    const ownedCard = ownedCards[0];
    if (!ownedCard) continue;
    const ownedImages = [...ownedCard.body.matchAll(/<img\b[^>]*>/giu)].map(
      (match) => match[0],
    );
    if (ownedImages.length !== 1) {
      errors.push(
        `${filename}: ${target.screenCode} cần đúng một img, nhận ${ownedImages.length}`,
      );
    } else {
      const image = ownedImages[0] ?? '';
      if (readAttribute(image, 'src') !== source) {
        errors.push(`${filename}: ${target.screenCode} sai src ${source}`);
      }
      if (readAttribute(image, 'alt') !== escapeHtml(target.alt)) {
        errors.push(
          `${filename}: alt của ${target.screenCode} không khớp ${target.filename}`,
        );
      }
    }
    const captions = [
      ...ownedCard.body.matchAll(
        /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/giu,
      ),
    ].map((match) => (match[1] ?? '').trim());
    if (captions.length !== 1 || captions[0] !== escapeHtml(target.caption)) {
      errors.push(
        `${filename}: caption của ${target.screenCode} không khớp ${target.filename}`,
      );
    }
    const headingName = directory === 'wireframes' ? 'h3' : 'h2';
    const headings = [
      ...ownedCard.body.matchAll(
        new RegExp(
          `<${headingName}\\b[^>]*>([\\s\\S]*?)<\\/${headingName}>`,
          'giu',
        ),
      ),
    ].map((match) => (match[1] ?? '').trim());
    if (
      headings.length !== 1 ||
      headings[0] !==
        `${escapeHtml(screen.code)} — ${escapeHtml(screen.displayTitle)}`
    ) {
      errors.push(
        `${filename}: heading của card ${target.screenCode} không chính xác`,
      );
    }
    const metadataBlocks = [
      ...ownedCard.body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/giu),
    ]
      .filter((match) =>
        (readAttribute(match[1] ?? '', 'class') ?? '')
          .split(/\s+/u)
          .includes('metadata'),
      )
      .map((match) => (match[2] ?? '').trim());
    const expectedMetadata =
      directory === 'wireframes'
        ? `Bố cục: ${escapeHtml(RECIPE_LABELS[screen.layoutRecipe])} · Số component: ${screen.components.length} · <code>${escapeHtml(target.filename)}</code>`
        : `Trang ${escapeHtml(target.pageLabel)} · Mockup high-fidelity Benadep · <code>${escapeHtml(target.filename)}</code>`;
    if (metadataBlocks.length !== 1 || metadataBlocks[0] !== expectedMetadata) {
      errors.push(
        `${filename}: metadata recipe/component của card ${target.screenCode} không chính xác`,
      );
    }
  }
  return errors;
};

const validateWireframeSheet = async (
  outputRoot: string,
): Promise<string[]> => {
  const result = await readContactSheet(outputRoot, CONTACT_SHEET_WIREFRAMES);
  if (!result.html) return [...result.errors];
  const html = result.html;
  const structuralHtml = stripHtmlComments(html);
  const errors = [
    ...result.errors,
    ...validateHtmlBase(CONTACT_SHEET_WIREFRAMES, html),
    ...validateTargetReferences(
      CONTACT_SHEET_WIREFRAMES,
      structuralHtml,
      'wireframes',
      WIREFRAME_TARGETS,
    ),
  ];
  if (count(structuralHtml, /<article\b/gu) !== WIREFRAME_TARGETS.length) {
    errors.push(`${CONTACT_SHEET_WIREFRAMES}: expected 59 article cards`);
  }
  if (
    count(structuralHtml, /<section\b[^>]*\bdata-page-label=/gu) !==
    UI_WIREFRAME_PAGES.length
  ) {
    errors.push(`${CONTACT_SHEET_WIREFRAMES}: expected 12 Page 3 sections`);
  }
  const sections = extractBlocks(structuralHtml, 'section');
  for (const page of UI_WIREFRAME_PAGES) {
    const groups = sections.filter(
      (section) =>
        readAttribute(section.attributes, 'data-page-label') === page.pageLabel,
    );
    if (groups.length !== 1) {
      errors.push(`${CONTACT_SHEET_WIREFRAMES}: thiếu nhóm ${page.pageLabel}`);
      continue;
    }
    const group = groups[0];
    if (!group) continue;
    const groupHeadings = [
      ...group.body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/giu),
    ].map((match) => (match[1] ?? '').trim());
    if (
      groupHeadings.length !== 1 ||
      groupHeadings[0] !==
        `${escapeHtml(page.pageLabel)} — ${escapeHtml(page.title)}`
    ) {
      errors.push(
        `${CONTACT_SHEET_WIREFRAMES}: nhóm ${page.pageLabel} sai title`,
      );
    }
    const actualCodes = extractBlocks(group.body, 'article').map(
      (article) => readAttribute(article.attributes, 'data-screen-code') ?? '',
    );
    if (
      actualCodes.length !== page.screenCodes.length ||
      actualCodes.some((code, index) => code !== page.screenCodes[index])
    ) {
      errors.push(
        `${CONTACT_SHEET_WIREFRAMES}: nhóm ${page.pageLabel} phải chứa đúng ${page.screenCodes.join(', ')}, nhận ${actualCodes.join(', ')}`,
      );
    }
  }
  return errors;
};

const validateMockupSheet = async (outputRoot: string): Promise<string[]> => {
  const result = await readContactSheet(outputRoot, CONTACT_SHEET_MOCKUPS);
  if (!result.html) return [...result.errors];
  const html = result.html;
  const structuralHtml = stripHtmlComments(html);
  const errors = [
    ...result.errors,
    ...validateHtmlBase(CONTACT_SHEET_MOCKUPS, html),
    ...validateTargetReferences(
      CONTACT_SHEET_MOCKUPS,
      structuralHtml,
      'mockups',
      MOCKUP_TARGETS,
    ),
  ];
  if (count(structuralHtml, /<article\b/gu) !== MOCKUP_TARGETS.length) {
    errors.push(`${CONTACT_SHEET_MOCKUPS}: expected 12 article cards`);
  }
  if (
    !/grid-template-columns\s*:\s*(?:minmax\(0\s*,\s*1fr\)|1fr)/iu.test(html)
  ) {
    errors.push(`${CONTACT_SHEET_MOCKUPS}: review grid phải có một cột`);
  }
  return errors;
};

export const validateGeneratedAssets = async (
  outputDir: string,
): Promise<string[]> => {
  const outputRoot = resolve(outputDir);
  const walked = await walkGeneratedOutput(outputRoot);
  const errors = [...walked.errors];
  const actualFiles = new Set(walked.files);

  for (const actual of actualFiles) {
    if (!EXPECTED_FILES.has(actual)) {
      errors.push(`${actual}: unexpected generated asset`);
    }
    if (actual.toLocaleLowerCase('en-US').endsWith('.svg')) {
      errors.push(`${actual}: intermediate SVG không được publish`);
    }
  }
  for (const expected of EXPECTED_FILES) {
    if (!actualFiles.has(expected)) {
      errors.push(`${expected}: missing generated asset`);
    }
  }

  for (const target of WIREFRAME_TARGETS) {
    errors.push(...(await validatePng(outputRoot, 'wireframes', target)));
  }
  for (const target of MOCKUP_TARGETS) {
    errors.push(...(await validatePng(outputRoot, 'mockups', target)));
  }
  errors.push(...(await validateWireframeSheet(outputRoot)));
  errors.push(...(await validateMockupSheet(outputRoot)));
  return [...new Set(errors)];
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  const outputDir = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(process.cwd(), 'docs/superpowers/assets/notion-srs-wireframes');
  const errors = await validateGeneratedAssets(outputDir);
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('71/71 valid\n');
  }
}
