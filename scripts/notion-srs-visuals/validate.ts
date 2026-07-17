import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BACKEND_SPECS } from './backend-specs.ts';
import { layoutDiagram } from './diagram-layout.ts';
import { auditDiagramGeometry } from './geometry-audit.ts';
import { auditVietnameseCopy } from './localization-policy.ts';
import { DIAGRAM_TARGETS } from './manifest.ts';
import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import { escapeXml, renderDiagram } from './svg-renderer.ts';
import type { TDiagramSpec, TDiagramTarget } from './types.ts';
import { UI_SPECS } from './ui-specs.ts';

const MAX_SVG_BYTES = 200 * 1024;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const PLACEHOLDER_PATTERN = /\b(?:TBD|TODO|FIXME|LOREM|PLACEHOLDER)\b/i;
const CODE_PATTERN = /\b(SP|CN|QT|MH|KT)-(\d{3})\b/gi;

const ALL_SPECS = [
  ...OVERVIEW_AND_TEST_SPECS,
  ...BACKEND_SPECS,
  ...UI_SPECS,
] as const satisfies readonly TDiagramSpec[];

const SPEC_BY_KEY = new Map<string, TDiagramSpec>(
  ALL_SPECS.map((spec) => [spec.key, spec]),
);

const countMatches = (value: string, pattern: RegExp): number =>
  value.match(pattern)?.length ?? 0;

const validateRenderedSemantics = (
  svg: string,
  target: TDiagramTarget,
  spec: TDiagramSpec,
): string[] => {
  const errors: string[] = [];
  let layout: ReturnType<typeof layoutDiagram>;
  try {
    layout = layoutDiagram(spec);
  } catch (error) {
    return [
      `${target.filename}: layout audit failed (${error instanceof Error ? error.message : String(error)})`,
    ];
  }

  for (const error of auditDiagramGeometry(layout)) {
    errors.push(`${target.filename}: geometry audit: ${error}`);
  }
  if (layout.viewBox.width !== 1400 || layout.viewBox.height !== 1800) {
    errors.push(`${target.filename}: layout viewBox must be 1400 × 1800`);
  }
  if (layout.bands.length !== 2) {
    errors.push(`${target.filename}: layout must contain exactly 2 bands`);
  }
  if (
    layout.typography.title !== 46 ||
    layout.typography.scope !== 24 ||
    layout.typography.connector !== 22 ||
    layout.typography.footer !== 22
  ) {
    errors.push(
      `${target.filename}: typography contract must include 46/24/22`,
    );
  }
  const expectedSvg = `${renderDiagram(spec)}\n`;

  const bandCount = countMatches(svg, /data-band-index=/g);
  if (
    bandCount !== 2 ||
    countMatches(svg, /data-band-index="0"/g) !== 1 ||
    countMatches(svg, /data-band-index="1"/g) !== 1
  ) {
    errors.push(
      `${target.filename}: SVG must expose exactly two bands indexed 0 and 1`,
    );
  }
  for (const fontSize of [46, 24, 22]) {
    const pattern = new RegExp(`font-size="${fontSize}"`, 'g');
    const actualCount = countMatches(svg, pattern);
    const expectedCount = countMatches(expectedSvg, pattern);
    if (actualCount !== expectedCount) {
      errors.push(
        `${target.filename}: font-size ${fontSize} expected ${expectedCount} uses, found ${actualCount}`,
      );
    }
  }
  if (svg.includes('…')) {
    errors.push(
      `${target.filename}: ellipsis is forbidden; copy must be lossless`,
    );
  }

  const directoryCount = countMatches(svg, /data-edge-directory-code=/g);
  if (directoryCount !== spec.edges.length) {
    errors.push(
      `${target.filename}: edge directory expected ${spec.edges.length} entries, found ${directoryCount}`,
    );
  }
  for (const item of layout.footer.edgeItems) {
    const directoryIdentity = `data-edge-directory-code="${escapeXml(item.code)}" data-edge-from="${escapeXml(item.edge.from)}" data-edge-to="${escapeXml(item.edge.to)}"`;
    if (svg.split(directoryIdentity).length !== 2) {
      errors.push(
        `${target.filename}: directory must contain exactly one ${item.code} entry for ${item.edge.from}->${item.edge.to}`,
      );
    }
    const losslessLabel = escapeXml(`${item.code} — ${item.edge.label}`);
    if (
      !svg.includes(`${directoryIdentity}><text`) ||
      !svg.includes(`>${losslessLabel}</text></g>`)
    ) {
      errors.push(
        `${target.filename}: directory entry ${item.code} must preserve its complete semantic label`,
      );
    }
  }

  const expectedReferenceEndpoints = layout.references.length * 2;
  if (
    countMatches(svg, /data-reference-code=/g) !== expectedReferenceEndpoints
  ) {
    errors.push(
      `${target.filename}: owner-node references expected ${expectedReferenceEndpoints} endpoints`,
    );
  }
  for (const reference of layout.references) {
    for (const endpoint of reference.endpoints) {
      const identity = `data-reference-code="${escapeXml(reference.code)}" data-reference-role="${endpoint.role}" data-reference-node-id="${escapeXml(endpoint.nodeId)}"`;
      if (svg.split(identity).length !== 2) {
        errors.push(
          `${target.filename}: reference ${reference.code}/${endpoint.role} must have exactly one owner node`,
        );
      }
    }
  }

  if (svg !== expectedSvg) {
    errors.push(
      `${target.filename}: does not match deterministic renderer bytes`,
    );
  }
  return errors;
};

const validateCodeRange = (svg: string, target: TDiagramTarget): string[] => {
  const range = target.codeRange.match(
    /\b(SP|CN|QT|MH|KT)-(\d{3})–\1-(\d{3})\b/,
  );
  if (!range) {
    return [];
  }

  const [, expectedPrefix, minimumText, maximumText] = range;
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  const errors: string[] = [];
  for (const match of svg.matchAll(CODE_PATTERN)) {
    const [, prefix, valueText] = match;
    const value = Number(valueText);
    if (
      prefix.toUpperCase() !== expectedPrefix ||
      value < minimum ||
      value > maximum
    ) {
      errors.push(
        `${target.filename}: ${match[0]} is outside ${target.codeRange}`,
      );
    }
  }
  return errors;
};

const validateSvg = async (
  outputDir: string,
  target: TDiagramTarget,
): Promise<string[]> => {
  const errors: string[] = [];
  const filename = target.filename;
  const pathname = resolve(outputDir, filename);
  let svg: string;

  try {
    const metadata = await stat(pathname);
    if (metadata.size >= MAX_SVG_BYTES) {
      errors.push(
        `${filename}: must be below 200 KiB (${metadata.size} bytes)`,
      );
    }
    svg = await readFile(pathname, 'utf8');
  } catch (error) {
    errors.push(
      `${filename}: missing or unreadable (${error instanceof Error ? error.message : String(error)})`,
    );
    return errors;
  }

  const spec = SPEC_BY_KEY.get(target.key);
  if (!spec) {
    errors.push(`${filename}: missing semantic spec for ${target.key}`);
  }

  if (
    !new RegExp(
      `^<svg\\s[^>]*xmlns=["']${SVG_NAMESPACE.replaceAll('.', '\\.')}["']`,
    ).test(svg)
  ) {
    errors.push(`${filename}: missing the SVG namespace`);
  }
  if (!/\bviewBox="0 0 1400 1800"/.test(svg)) {
    errors.push(`${filename}: viewBox must be 0 0 1400 1800`);
  }
  const expectedTitle = `<title id="diagram-title">${escapeXml(target.title)}</title>`;
  if (!svg.includes(expectedTitle) || svg.includes(filename)) {
    errors.push(`${filename}: missing filename-independent semantic title`);
  }
  if (spec) {
    const expectedDescriptionPrefix = `<desc id="diagram-desc">${escapeXml(`${spec.subtitle}. ${spec.scope}. Các nút:`)}`;
    if (!svg.includes(expectedDescriptionPrefix)) {
      errors.push(
        `${filename}: missing filename-independent semantic description`,
      );
    }
    errors.push(...validateRenderedSemantics(svg, target, spec));
  } else if (!/<desc\b[^>]*>[^<]+<\/desc>/.test(svg)) {
    errors.push(`${filename}: missing semantic description`);
  }

  if (/<\s*script\b/i.test(svg)) {
    errors.push(`${filename}: contains a script element`);
  }
  if (/<\s*image\b/i.test(svg)) {
    errors.push(`${filename}: contains an image element`);
  }
  if (/javascript:/i.test(svg)) {
    errors.push(`${filename}: contains a javascript URL`);
  }
  if (/\bon\w+\s*=/i.test(svg)) {
    errors.push(`${filename}: contains an event-handler attribute`);
  }
  if (/\bhref\s*=/i.test(svg)) {
    errors.push(`${filename}: contains an href resource`);
  }
  if (/https?:\/\//i.test(svg.replaceAll(SVG_NAMESPACE, ''))) {
    errors.push(`${filename}: contains an external http(s) resource`);
  }
  const placeholder = svg.match(PLACEHOLDER_PATTERN)?.[0];
  if (placeholder) {
    errors.push(`${filename}: contains placeholder ${placeholder}`);
  }

  errors.push(...validateCodeRange(svg, target));
  return errors;
};

const validateContactSheet = async (outputDir: string): Promise<string[]> => {
  const errors: string[] = [];
  let html: string;
  try {
    html = await readFile(resolve(outputDir, 'contact-sheet.html'), 'utf8');
  } catch (error) {
    return [
      `contact-sheet.html: missing or unreadable (${error instanceof Error ? error.message : String(error)})`,
    ];
  }

  const objectCount =
    html.match(/<object\b[^>]*type="image\/svg\+xml"/g)?.length ?? 0;
  if (objectCount !== DIAGRAM_TARGETS.length) {
    errors.push(
      `contact-sheet.html: expected 28 SVG objects, found ${objectCount}`,
    );
  }
  if (!/<html lang="vi">/.test(html)) {
    errors.push(
      'contact-sheet.html: Vietnamese language contract requires lang="vi"',
    );
  }
  if (!/aspect-ratio:\s*7\s*\/\s*9/.test(html)) {
    errors.push('contact-sheet.html: object aspect-ratio must be 7 / 9');
  }
  if (!/#review-700:checked[^{}]*\{[^}]*width:\s*700px/.test(html)) {
    errors.push('contact-sheet.html: missing the 700px review width');
  }
  if (!/#review-1000:checked[^{}]*\{[^}]*width:\s*1000px/.test(html)) {
    errors.push('contact-sheet.html: missing the 1000px review width');
  }
  if (
    !html.includes('Bộ duyệt sơ đồ SRS Affiliate Benadep') ||
    /visual contact sheet|deterministic SVG diagrams|desktop width/i.test(html)
  ) {
    errors.push('contact-sheet.html: visible reviewer copy must be Vietnamese');
  }
  for (const target of DIAGRAM_TARGETS) {
    if (!html.includes(`data="./${target.filename}"`)) {
      errors.push(`contact-sheet.html: missing object for ${target.filename}`);
    }
    if (!html.includes(target.key) || !html.includes(target.codeRange)) {
      errors.push(
        `contact-sheet.html: missing metadata for ${target.filename}`,
      );
    }
  }
  return errors;
};

export const validateGeneratedAssets = async (
  outputDir: string,
): Promise<string[]> => {
  const errors: string[] = [];
  errors.push(
    ...auditVietnameseCopy(DIAGRAM_TARGETS, ALL_SPECS).map(
      (error) => `Vietnamese copy audit: ${error}`,
    ),
  );
  const expectedFilenames = new Set([
    'contact-sheet.html',
    ...DIAGRAM_TARGETS.map((target) => target.filename),
  ]);

  try {
    for (const filename of await readdir(outputDir)) {
      if (!expectedFilenames.has(filename)) {
        errors.push(`${filename}: unexpected generated asset`);
      }
    }
  } catch (error) {
    errors.push(
      `${outputDir}: unreadable output directory (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  for (const target of DIAGRAM_TARGETS) {
    errors.push(...(await validateSvg(outputDir, target)));
  }
  errors.push(...(await validateContactSheet(outputDir)));
  return errors;
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  const outputDir = resolve(
    process.cwd(),
    'docs/superpowers/assets/notion-srs-visuals',
  );
  const errors = await validateGeneratedAssets(outputDir);
  if (errors.length > 0) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `${DIAGRAM_TARGETS.length}/${DIAGRAM_TARGETS.length} valid\n`,
    );
  }
}
