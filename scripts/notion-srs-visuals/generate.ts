import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BACKEND_SPECS } from './backend-specs.ts';
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
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Benadep Affiliate SRS visual contact sheet</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0 auto; max-width: 1680px; padding: 32px; color: #17202a; background: #f4f6f8; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .intro { margin: 0 0 32px; color: #4b5563; }
    article { margin: 0 0 40px; padding: 24px; border: 1px solid #c9d1da; border-radius: 16px; background: #fff; }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
    h2 { margin: 0 0 16px; font-size: 24px; }
    header p { margin: 0 0 16px; color: #4b5563; }
    object { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid #aeb8c4; background: #fff; }
  </style>
</head>
<body>
  <h1>Benadep Affiliate SRS visual contact sheet</h1>
  <p class="intro">28 deterministic SVG diagrams. Review at desktop width and 50% zoom before Notion placement.</p>
${diagrams}
</body>
</html>
`;
};

export const generateAll = async (outputDir: string): Promise<void> => {
  const specsByKey = getSpecsByKey();
  await mkdir(outputDir, { recursive: true });

  for (const target of DIAGRAM_TARGETS) {
    const spec = specsByKey.get(target.key);
    if (!spec) {
      throw new Error(`Missing diagram spec: ${target.key}`);
    }
    await writeFile(
      resolve(outputDir, target.filename),
      `${renderDiagram(spec)}\n`,
      'utf8',
    );
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
