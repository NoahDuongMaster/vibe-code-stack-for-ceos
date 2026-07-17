import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { BACKEND_SPECS } from './backend-specs.ts';
import { layoutDiagram } from './diagram-layout.ts';
import { generateAll } from './generate.ts';
import { auditDiagramGeometry } from './geometry-audit.ts';
import { auditVietnameseCopy } from './localization-policy.ts';
import { DIAGRAM_TARGETS } from './manifest.ts';
import { OVERVIEW_AND_TEST_SPECS } from './overview-and-test-specs.ts';
import { escapeXml } from './svg-renderer.ts';
import { UI_SPECS } from './ui-specs.ts';
import { validateGeneratedAssets } from './validate.ts';

const ALL_SPECS = [...OVERVIEW_AND_TEST_SPECS, ...BACKEND_SPECS, ...UI_SPECS];
const SPEC_BY_KEY = new Map(ALL_SPECS.map((spec) => [spec.key, spec]));

const PLACEHOLDER_PATTERN = /\b(?:TBD|TODO|FIXME|LOREM|PLACEHOLDER)\b/i;
const UNSAFE_PATTERN = /<\s*(?:script|image)\b|javascript:|\bon\w+\s*=/i;
const CODE_PATTERN = /\b(SP|CN|QT|MH|KT)-(\d{3})\b/gi;

const withTemporaryDirectories = async (
  run: (first: string, second: string) => Promise<void>,
): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'notion-srs-visuals-'));
  const first = join(root, 'first');
  const second = join(root, 'second');

  try {
    await run(first, second);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const assertCodesStayInRange = (svg: string, codeRange: string): void => {
  const range = codeRange.match(/\b(SP|CN|QT|MH|KT)-(\d{3})–\1-(\d{3})\b/);
  if (!range) {
    return;
  }

  const [, expectedPrefix, first, last] = range;
  for (const match of svg.matchAll(CODE_PATTERN)) {
    const [, prefix, value] = match;
    assert.equal(
      prefix.toUpperCase(),
      expectedPrefix,
      `${match[0]} uses the wrong code family`,
    );
    assert.ok(
      Number(value) >= Number(first) && Number(value) <= Number(last),
      `${match[0]} is outside ${codeRange}`,
    );
  }
};

test('should merge exactly the same unique keys as the approved manifest', () => {
  const actualKeys = ALL_SPECS.map((spec) => spec.key).sort();
  const expectedKeys = DIAGRAM_TARGETS.map((target) => target.key).sort();

  assert.equal(new Set(actualKeys).size, 28);
  assert.deepEqual(actualKeys, expectedKeys);
});

test('should generate 28 safe, bounded SVGs and a complete contact sheet', async () => {
  await withTemporaryDirectories(async (outputDir) => {
    assert.deepEqual(auditVietnameseCopy(DIAGRAM_TARGETS, ALL_SPECS), []);
    await generateAll(outputDir);

    const filenames = (await readdir(outputDir)).sort();
    assert.deepEqual(
      filenames,
      [
        'contact-sheet.html',
        ...DIAGRAM_TARGETS.map((target) => target.filename),
      ].sort(),
    );

    for (const target of DIAGRAM_TARGETS) {
      const spec = SPEC_BY_KEY.get(target.key);
      assert.ok(spec, target.key);
      assert.deepEqual(auditDiagramGeometry(layoutDiagram(spec)), []);
      const svg = await readFile(join(outputDir, target.filename), 'utf8');
      assert.ok(Buffer.byteLength(svg) < 200 * 1024, target.filename);
      assert.match(svg, /^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(svg, /\bviewBox="0 0 1400 1800"/);
      assert.doesNotMatch(svg, /…/);
      assert.match(svg, /font-size="46"/);
      assert.match(svg, /font-size="24"/);
      assert.match(svg, /font-size="22"/);
      assert.equal((svg.match(/data-band-index=/g) ?? []).length, 2);
      assert.equal(
        (svg.match(/data-edge-directory-code=/g) ?? []).length,
        spec.edges.length,
      );
      assert.ok(
        svg.includes(
          `<title id="diagram-title">${escapeXml(target.title)}</title>`,
        ),
        `${target.filename}: title`,
      );
      assert.match(svg, /<desc\b[^>]*>[^<]+<\/desc>/);
      assert.ok(
        !svg.includes(target.filename),
        `${target.filename}: semantic title`,
      );
      assert.doesNotMatch(svg, UNSAFE_PATTERN, target.filename);
      assert.doesNotMatch(svg, /\bhref\s*=/i, target.filename);
      assert.doesNotMatch(
        svg.replace('http://www.w3.org/2000/svg', ''),
        /https?:\/\//i,
        target.filename,
      );
      assert.doesNotMatch(svg, PLACEHOLDER_PATTERN, target.filename);
      assertCodesStayInRange(svg, target.codeRange);
    }

    const contactSheet = await readFile(
      join(outputDir, 'contact-sheet.html'),
      'utf8',
    );
    assert.equal(
      contactSheet.match(/<object\b[^>]*type="image\/svg\+xml"/g)?.length,
      28,
    );
    assert.match(contactSheet, /<fieldset class="review-controls">/);
    assert.match(contactSheet, /<legend>Chiều rộng duyệt:<\/legend>/);
    assert.doesNotMatch(contactSheet, /role="group"/);
    assert.match(contactSheet, /<html lang="vi">/);
    assert.match(contactSheet, /aspect-ratio:\s*7\s*\/\s*9/);
    assert.match(
      contactSheet,
      /#review-700:checked[^{}]*\{[^}]*width:\s*700px/,
    );
    assert.match(
      contactSheet,
      /#review-1000:checked[^{}]*\{[^}]*width:\s*1000px/,
    );
    assert.match(contactSheet, /Bộ duyệt sơ đồ SRS Affiliate Benadep/);
    assert.doesNotMatch(
      contactSheet,
      /visual contact sheet|deterministic SVG diagrams|desktop width/i,
    );
    for (const target of DIAGRAM_TARGETS) {
      assert.match(contactSheet, new RegExp(`data="\\./${target.filename}"`));
      assert.ok(contactSheet.includes(target.key));
      assert.ok(contactSheet.includes(target.codeRange));
    }

    assert.deepEqual(await validateGeneratedAssets(outputDir), []);
  });
});

test('should produce byte-identical output across two runs', async () => {
  await withTemporaryDirectories(async (first, second) => {
    await Promise.all([generateAll(first), generateAll(second)]);

    const filenames = (await readdir(first)).sort();
    assert.deepEqual(filenames, (await readdir(second)).sort());

    for (const filename of filenames) {
      assert.deepEqual(
        await readFile(join(first, filename)),
        await readFile(join(second, filename)),
        filename,
      );
    }
  });
});

test('should report every generated-asset contract violation together', async () => {
  await withTemporaryDirectories(async (outputDir) => {
    await generateAll(outputDir);

    const firstTarget = DIAGRAM_TARGETS.find(
      (target) => target.key === '2-01-backend',
    );
    assert.ok(firstTarget);
    const firstPath = join(outputDir, firstTarget.filename);
    const firstSvg = await readFile(firstPath, 'utf8');
    await writeFile(
      firstPath,
      firstSvg
        .replace('<title id="diagram-title">', '<title-missing>')
        .replace('viewBox="0 0 1400 1800"', 'viewBox="0 0 1600 900"')
        .replace('data-band-index="0"', 'data-band-missing="0"')
        .replace('font-size="24"', 'font-size="23"')
        .replace('data-edge-directory-code=', 'data-edge-directory-missing=')
        .concat('…')
        .concat('<script href="https://example.com/x.js">TODO CN-999</script>'),
    );
    const contactPath = join(outputDir, 'contact-sheet.html');
    const contactSheet = await readFile(contactPath, 'utf8');
    await writeFile(
      contactPath,
      contactSheet
        .replace('<html lang="vi">', '<html lang="en">')
        .replace('aspect-ratio: 7 / 9', 'aspect-ratio: 16 / 9')
        .replace('width: 700px', 'width: 701px'),
    );
    await writeFile(join(outputDir, 'unexpected.svg'), '<svg/>');

    const errors = await validateGeneratedAssets(outputDir);
    const report = errors.join('\n');
    assert.match(report, /unexpected\.svg.*unexpected/i);
    assert.match(report, /title/i);
    assert.match(report, /script/i);
    assert.match(report, /external|https/i);
    assert.match(report, /placeholder|TODO/i);
    assert.match(report, /CN-999.*CN-001–CN-009/i);
    assert.match(report, /viewBox.*1400 1800/i);
    assert.match(report, /two.*band|2.*band/i);
    assert.match(report, /font-size.*24|typography.*24/i);
    assert.match(report, /ellipsis/i);
    assert.match(report, /directory/i);
    assert.match(report, /deterministic|renderer bytes/i);
    assert.match(report, /lang="vi"|Vietnamese language/i);
    assert.match(report, /aspect-ratio.*7.*9/i);
    assert.match(report, /700px/i);
  });
});
