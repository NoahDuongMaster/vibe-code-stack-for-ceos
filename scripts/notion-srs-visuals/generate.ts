import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BACKEND_SPECS } from './backend-specs.ts';
import { layoutDiagram } from './diagram-layout.ts';
import { auditDiagramGeometry } from './geometry-audit.ts';
import { auditVietnameseCopy } from './localization-policy.ts';
import { DIAGRAM_TARGETS } from './manifest.ts';
import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import { escapeXml, renderDiagram } from './svg-renderer.ts';
import type { TDiagramSpec } from './types.ts';
import { UI_SPECS } from './ui-specs.ts';

const DIAGRAM_SPECS = [
  ...OVERVIEW_AND_TEST_SPECS,
  ...BACKEND_SPECS,
  ...UI_SPECS,
] as const satisfies readonly TDiagramSpec[];

const MAX_SVG_BYTES = 200 * 1024;

const getSpecsByKey = (): ReadonlyMap<string, TDiagramSpec> => {
  const specsByKey = new Map<string, TDiagramSpec>();
  for (const spec of DIAGRAM_SPECS) {
    if (specsByKey.has(spec.key)) {
      throw new Error(`Duplicate diagram spec: ${spec.key}`);
    }
    specsByKey.set(spec.key, spec);
  }

  const targetKeys = new Set(DIAGRAM_TARGETS.map((target) => target.key));
  const missing = DIAGRAM_TARGETS.filter(
    (target) => !specsByKey.has(target.key),
  ).map((target) => target.key);
  const extra = [...specsByKey.keys()].filter((key) => !targetKeys.has(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Diagram spec/manifest mismatch; missing=[${missing.join(', ')}], extra=[${extra.join(', ')}]`,
    );
  }

  return specsByKey;
};

const renderContactSheet = (): string => {
  const diagrams = DIAGRAM_TARGETS.map(
    (target) => `<article>
  <header>
    <h2>${escapeXml(target.title)}</h2>
    <p><code>${escapeXml(target.key)}</code> · ${escapeXml(target.codeRange)}</p>
  </header>
  <object data="./${escapeXml(target.filename)}" type="image/svg+xml" aria-label="${escapeXml(target.alt)}">
    <p>${escapeXml(target.alt)}</p>
  </object>
</article>`,
  ).join('\n');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bộ duyệt sơ đồ SRS Affiliate Benadep</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0 auto; max-width: 1100px; padding: 32px; color: #17202a; background: #f4f6f8; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .intro { margin: 0 0 20px; color: #4b5563; }
    .review-controls { display: flex; align-items: center; gap: 16px; margin: 0 0 32px; padding: 0; border: 0; }
    .review-controls legend { padding: 0; font-weight: 700; }
    .review-controls label { font-weight: 700; cursor: pointer; }
    article { margin: 0 0 40px; padding: 24px; border: 1px solid #c9d1da; border-radius: 16px; background: #fff; }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
    h2 { margin: 0 0 16px; font-size: 24px; }
    header p { margin: 0 0 16px; color: #4b5563; }
    object { display: block; max-width: 100%; aspect-ratio: 7 / 9; border: 1px solid #aeb8c4; background: #fff; }
    body:has(#review-700:checked) main object { width: 700px; }
    body:has(#review-1000:checked) main object { width: 1000px; }
  </style>
</head>
<body>
  <h1>Bộ duyệt sơ đồ SRS Affiliate Benadep</h1>
  <p class="intro">28 sơ đồ SVG tất định. Chọn chiều rộng duyệt để kiểm tra khả năng đọc trước khi đặt vào Notion.</p>
  <fieldset class="review-controls">
    <legend>Chiều rộng duyệt:</legend>
    <input id="review-700" name="review-width" type="radio" checked>
    <label for="review-700">700 px</label>
    <input id="review-1000" name="review-width" type="radio">
    <label for="review-1000">1000 px</label>
  </fieldset>
  <main>
${diagrams}
  </main>
</body>
</html>
`;
};

const prepareSvgAssets = (
  specsByKey: ReadonlyMap<string, TDiagramSpec>,
): ReadonlyMap<string, string> => {
  const errors = auditVietnameseCopy(DIAGRAM_TARGETS, DIAGRAM_SPECS).map(
    (error) => `Vietnamese copy audit: ${error}`,
  );
  const assets = new Map<string, string>();

  for (const target of DIAGRAM_TARGETS) {
    const spec = specsByKey.get(target.key);
    if (!spec) {
      errors.push(`${target.filename}: missing diagram spec`);
      continue;
    }

    try {
      const layout = layoutDiagram(spec);
      errors.push(...auditDiagramGeometry(layout));
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
      if (layout.footer.edgeItems.length !== spec.edges.length) {
        errors.push(
          `${target.filename}: edge directory must contain exactly one entry per semantic edge`,
        );
      }

      const svg = `${renderDiagram(spec)}\n`;
      if (Buffer.byteLength(svg) >= MAX_SVG_BYTES) {
        errors.push(`${target.filename}: must be below 200 KiB`);
      }
      if (svg.includes('…')) {
        errors.push(
          `${target.filename}: visible copy must not use an ellipsis`,
        );
      }
      assets.set(target.filename, svg);
    } catch (error) {
      errors.push(
        `${target.filename}: generation audit failed (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return assets;
};

export const generateAll = async (outputDir: string): Promise<void> => {
  const specsByKey = getSpecsByKey();
  const svgAssets = prepareSvgAssets(specsByKey);
  await mkdir(outputDir, { recursive: true });

  for (const target of DIAGRAM_TARGETS) {
    const svg = svgAssets.get(target.filename);
    if (!svg) {
      throw new Error(`Missing rendered SVG: ${target.filename}`);
    }
    await writeFile(resolve(outputDir, target.filename), svg, 'utf8');
  }

  await writeFile(
    resolve(outputDir, 'contact-sheet.html'),
    renderContactSheet(),
    'utf8',
  );
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  const outputDir = resolve(
    process.cwd(),
    'docs/superpowers/assets/notion-srs-visuals',
  );
  await generateAll(outputDir);
  process.stdout.write(`${DIAGRAM_TARGETS.length} SVGs generated\n`);
}
