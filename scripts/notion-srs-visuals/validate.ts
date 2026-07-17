import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BACKEND_SPECS } from './backend-specs.ts';
import { DIAGRAM_TARGETS } from './manifest.ts';
import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import { escapeXml } from './svg-renderer.ts';
import type { TDiagramSpec, TDiagramTarget } from './types.ts';
import { UI_SPECS } from './ui-specs.ts';

const MAX_SVG_BYTES = 200 * 1024;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const PLACEHOLDER_PATTERN = /\b(?:TBD|TODO|FIXME|LOREM|PLACEHOLDER)\b/i;
const CODE_PATTERN = /\b(SP|CN|QT|MH|KT)-(\d{3})\b/gi;

const SPEC_BY_KEY = new Map<string, TDiagramSpec>(
  [...OVERVIEW_AND_TEST_SPECS, ...BACKEND_SPECS, ...UI_SPECS].map((spec) => [
    spec.key,
    spec,
  ]),
);

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
  if (!/\bviewBox="0 0 1600 900"/.test(svg)) {
    errors.push(`${filename}: viewBox must be 0 0 1600 900`);
  }
  const expectedTitle = `<title id="diagram-title">${escapeXml(target.title)}</title>`;
  if (!svg.includes(expectedTitle) || svg.includes(filename)) {
    errors.push(`${filename}: missing filename-independent semantic title`);
  }
  if (spec) {
    const expectedDescription = `<desc id="diagram-desc">${escapeXml(`${spec.subtitle}. ${spec.scope}`)}</desc>`;
    if (!svg.includes(expectedDescription)) {
      errors.push(
        `${filename}: missing filename-independent semantic description`,
      );
    }
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
