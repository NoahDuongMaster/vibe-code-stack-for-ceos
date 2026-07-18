import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, test } from 'node:test';
import { generateAssets, recoverAssetPublication } from './generate.ts';
import {
  MOCKUP_TARGETS,
  UI_WIREFRAME_PAGES,
  WIREFRAME_TARGETS,
} from './manifest.ts';
import { readPngMetadata } from './png-metadata.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';
import { validateGeneratedAssets } from './validate.ts';

const CONTACT_SHEETS = [
  'contact-sheet-mockups.html',
  'contact-sheet-wireframes.html',
] as const;
const EXPECTED_AUDITS = [
  'accessibility',
  'contract',
  'geometry',
  'localization',
] as const;
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
const MAX_PNG_BYTES = 5 * 1024 * 1024;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const walkFiles = async (root: string): Promise<readonly string[]> => {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(relative(root, path));
      else throw new Error(`Generated output is not a regular file: ${path}`);
    }
  };
  await visit(root);
  return files.sort();
};

type TFixture = Readonly<{
  temporaryDirectory: string;
  firstRoot: string;
  secondRoot: string;
  firstReport: Awaited<ReturnType<typeof generateAssets>>;
  secondReport: Awaited<ReturnType<typeof generateAssets>>;
}>;

let fixturePromise: Promise<TFixture> | undefined;

const generationFixture = (): Promise<TFixture> => {
  fixturePromise ??= (async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), 'notion-srs-generate-test-'),
    );
    const firstRoot = join(temporaryDirectory, 'first');
    const secondRoot = join(temporaryDirectory, 'second');
    const firstReport = await generateAssets(firstRoot);
    const secondReport = await generateAssets(secondRoot);
    return {
      temporaryDirectory,
      firstRoot,
      secondRoot,
      firstReport,
      secondReport,
    };
  })();
  return fixturePromise;
};

after(async () => {
  if (!fixturePromise) return;
  const fixture = await fixturePromise.catch(() => undefined);
  if (fixture) {
    await rm(fixture.temporaryDirectory, { force: true, recursive: true });
  }
});

const assertGenerationReport = (
  report: Awaited<ReturnType<typeof generateAssets>>,
): void => {
  assert.equal(report.wireframes, 59);
  assert.equal(report.mockups, 12);
  assert.deepEqual(report.preRasterAuditErrors, []);
  assert.deepEqual([...report.preRasterAudits].sort(), EXPECTED_AUDITS);
};

const assertReviewControls = (html: string): void => {
  assert.match(html, /<fieldset\b/iu);
  assert.match(html, /<legend\b[^>]*>[^<]*(?:Chế độ|Tỷ lệ|Kích thước)/iu);
  assert.match(
    html,
    /<input\b(?=[^>]*\btype="radio")(?=[^>]*\bvalue="fit")[^>]*>/iu,
  );
  assert.match(
    html,
    /<input\b(?=[^>]*\btype="radio")(?=[^>]*\bvalue="100")[^>]*>/iu,
  );
  assert.match(html, /Vừa chiều rộng|Khớp chiều rộng|Fit width/iu);
  assert.match(html, /100%/u);
};

test('should generate the exact deterministic 59+12 PNG and two-HTML asset set twice', async () => {
  const { firstRoot, secondRoot, firstReport, secondReport } =
    await generationFixture();
  assertGenerationReport(firstReport);
  assertGenerationReport(secondReport);

  const expectedFiles = [
    ...WIREFRAME_TARGETS.map((target) => `wireframes/${target.filename}`),
    ...MOCKUP_TARGETS.map((target) => `mockups/${target.filename}`),
    ...CONTACT_SHEETS,
  ].sort();
  const [firstFiles, secondFiles] = await Promise.all([
    walkFiles(firstRoot),
    walkFiles(secondRoot),
  ]);
  assert.deepEqual(firstFiles, expectedFiles);
  assert.deepEqual(secondFiles, expectedFiles);
  assert.equal(firstFiles.filter((file) => file.endsWith('.png')).length, 71);
  assert.equal(firstFiles.filter((file) => file.endsWith('.html')).length, 2);
  assert.equal(
    firstFiles.some((file) => file.endsWith('.svg')),
    false,
  );

  for (const file of expectedFiles) {
    const [first, second] = await Promise.all([
      readFile(join(firstRoot, file)),
      readFile(join(secondRoot, file)),
    ]);
    assert.equal(sha256(first), sha256(second), file);
  }
  assert.deepEqual(await validateGeneratedAssets(firstRoot), []);
  assert.deepEqual(await validateGeneratedAssets(secondRoot), []);
});

test('should publish only valid opaque RGB8 4K PNGs below the Notion size limit', async () => {
  const { firstRoot } = await generationFixture();
  const targets = [
    ...WIREFRAME_TARGETS.map((target) => ({
      directory: 'wireframes',
      target,
    })),
    ...MOCKUP_TARGETS.map((target) => ({
      directory: 'mockups',
      target,
    })),
  ] as const;
  for (const { directory, target } of targets) {
    const png = await readFile(join(firstRoot, directory, target.filename));
    assert.ok(png.length < MAX_PNG_BYTES, target.filename);
    assert.deepEqual(readPngMetadata(png), {
      width: 3840,
      height: 2880,
      bitDepth: 8,
      colorType: 2,
      opaque: true,
    });
  }
});

test('should make the wireframe sheet semantic, Vietnamese and grouped by all twelve Page 3 labels', async () => {
  const { firstRoot } = await generationFixture();
  const html = await readFile(
    join(firstRoot, 'contact-sheet-wireframes.html'),
    'utf8',
  );
  assert.match(html, /<html\b[^>]*\blang="vi"/iu);
  assert.match(html, /<meta\b[^>]*\bcharset="utf-8"/iu);
  assert.match(html, /<title>[^<]*(?:Wireframe|khung dây)[^<]*<\/title>/iu);
  assertReviewControls(html);
  assert.equal((html.match(/<article\b/gu) ?? []).length, 59);
  assert.equal(
    (html.match(/<section\b[^>]*\bdata-page-label=/gu) ?? []).length,
    12,
  );

  for (const [pageIndex, page] of UI_WIREFRAME_PAGES.entries()) {
    const marker = `data-page-label="${escapeHtml(page.pageLabel)}"`;
    const start = html.indexOf(marker);
    const nextPage = UI_WIREFRAME_PAGES[pageIndex + 1];
    const end = nextPage
      ? html.indexOf(
          `data-page-label="${escapeHtml(nextPage.pageLabel)}"`,
          start + marker.length,
        )
      : html.length;
    assert.notEqual(start, -1, page.pageLabel);
    assert.ok(end > start, page.pageLabel);
    const group = html.slice(start, end);
    assert.equal(group.includes(escapeHtml(page.title)), true, page.pageLabel);

    for (const code of page.screenCodes) {
      const target = WIREFRAME_TARGETS.find(
        (candidate) => candidate.screenCode === code,
      );
      const screen = SCREEN_CONTRACTS.find(
        (candidate) => candidate.code === code,
      );
      assert.ok(target, code);
      assert.ok(screen, code);
      assert.equal(group.includes(escapeHtml(code)), true, code);
      assert.equal(group.includes(escapeHtml(screen.displayTitle)), true, code);
      assert.equal(
        group.includes(
          `Bố cục: ${escapeHtml(RECIPE_LABELS[screen.layoutRecipe])}`,
        ),
        true,
        `${code}: recipe`,
      );
      assert.equal(
        group.includes(`Số component: ${screen.components.length}`),
        true,
        `${code}: component count`,
      );
      assert.equal(group.includes(escapeHtml(target.filename)), true, code);
      assert.equal(group.includes(escapeHtml(target.alt)), true, code);
    }
  }
});

test('should make the mockup sheet a semantic Vietnamese one-column fit and 100-percent review surface', async () => {
  const { firstRoot } = await generationFixture();
  const html = await readFile(
    join(firstRoot, 'contact-sheet-mockups.html'),
    'utf8',
  );
  assert.match(html, /<html\b[^>]*\blang="vi"/iu);
  assert.match(html, /<meta\b[^>]*\bcharset="utf-8"/iu);
  assert.match(html, /<title>[^<]*Mockup[^<]*<\/title>/iu);
  assertReviewControls(html);
  assert.match(
    html,
    /grid-template-columns\s*:\s*(?:minmax\(0\s*,\s*1fr\)|1fr)/iu,
  );
  assert.equal((html.match(/<article\b/gu) ?? []).length, 12);

  for (const target of MOCKUP_TARGETS) {
    const screen = SCREEN_CONTRACTS.find(
      (candidate) => candidate.code === target.screenCode,
    );
    assert.ok(screen, target.screenCode);
    assert.equal(html.includes(escapeHtml(target.filename)), true);
    assert.equal(html.includes(escapeHtml(target.alt)), true);
    assert.equal(html.includes(escapeHtml(target.caption)), true);
    assert.equal(html.includes(escapeHtml(screen.displayTitle)), true);
  }
});

test('should reject executable HTML and metadata assigned to the wrong card or Page 3 group', async () => {
  const { firstRoot } = await generationFixture();
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-validator-adversarial-'),
  );
  const mutationRoot = join(temporaryDirectory, 'mutated');
  await cp(firstRoot, mutationRoot, { recursive: true });

  try {
    const mockupPath = join(mutationRoot, 'contact-sheet-mockups.html');
    const originalMockupHtml = await readFile(mockupPath, 'utf8');
    await writeFile(
      mockupPath,
      originalMockupHtml.replace('<img ', '<img onerror = "alert(1)" '),
      'utf8',
    );
    assert.match(
      (await validateGeneratedAssets(mutationRoot)).join('\n'),
      /event handler|onerror/iu,
    );
    await writeFile(
      mockupPath,
      originalMockupHtml.replace('<img ', '<img/onload="alert(1)" '),
      'utf8',
    );
    assert.match(
      (await validateGeneratedAssets(mutationRoot)).join('\n'),
      /event handler|onload/iu,
    );

    const firstAlt = escapeHtml(MOCKUP_TARGETS[0]?.alt ?? '');
    const secondAlt = escapeHtml(MOCKUP_TARGETS[1]?.alt ?? '');
    assert.notEqual(firstAlt, '');
    assert.notEqual(secondAlt, '');
    const swappedAltHtml = originalMockupHtml
      .replace(firstAlt, '__FIRST_ALT__')
      .replace(secondAlt, firstAlt)
      .replace('__FIRST_ALT__', secondAlt);
    await writeFile(mockupPath, swappedAltHtml, 'utf8');
    assert.match(
      (await validateGeneratedAssets(mutationRoot)).join('\n'),
      /alt.*(?:MH-001|MH-006)|(?:MH-001|MH-006).*alt/iu,
    );

    await writeFile(mockupPath, originalMockupHtml, 'utf8');
    const wireframePath = join(mutationRoot, 'contact-sheet-wireframes.html');
    const originalWireframeHtml = await readFile(wireframePath, 'utf8');
    const swappedGroupsHtml = originalWireframeHtml
      .replace('data-page-label="3.01"', 'data-page-label="__PAGE__"')
      .replace('data-page-label="3.02"', 'data-page-label="3.01"')
      .replace('data-page-label="__PAGE__"', 'data-page-label="3.02"');
    await writeFile(wireframePath, swappedGroupsHtml, 'utf8');
    assert.match(
      (await validateGeneratedAssets(mutationRoot)).join('\n'),
      /nhóm 3\.0[12].*(?:MH-001|MH-006)|(?:MH-001|MH-006).*nhóm 3\.0[12]/iu,
    );

    const wrongCountHtml = originalWireframeHtml.replace(
      'Số component: 6',
      'Số component: 106<!-- Số component: 6 -->',
    );
    assert.notEqual(wrongCountHtml, originalWireframeHtml);
    await writeFile(wireframePath, wrongCountHtml, 'utf8');
    assert.match(
      (await validateGeneratedAssets(mutationRoot)).join('\n'),
      /(?:component|metadata).*MH-001|MH-001.*(?:component|metadata)/iu,
    );

    const firstPage = UI_WIREFRAME_PAGES[0];
    assert.ok(firstPage);
    const expectedPageHeading = `${escapeHtml(firstPage.pageLabel)} — ${escapeHtml(firstPage.title)}`;
    const hiddenTitleHtml = originalWireframeHtml.replace(
      `<h2>${expectedPageHeading}</h2>`,
      `<h2>SAI TITLE</h2><!-- ${expectedPageHeading} -->`,
    );
    assert.notEqual(hiddenTitleHtml, originalWireframeHtml);
    await writeFile(wireframePath, hiddenTitleHtml, 'utf8');
    assert.match(
      (await validateGeneratedAssets(mutationRoot)).join('\n'),
      /nhóm 3\.01 sai title/iu,
    );
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should refuse to replace an unowned output directory and preserve its files', async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-output-ownership-'),
  );
  const outputRoot = join(temporaryDirectory, 'user-documents');
  const userFile = join(outputRoot, 'keep-me.txt');
  await mkdir(outputRoot);
  await writeFile(userFile, 'không được xóa', 'utf8');

  try {
    await assert.rejects(
      generateAssets(outputRoot),
      /không thuộc bộ asset|không hợp lệ|unowned/iu,
    );
    assert.equal(await readFile(userFile, 'utf8'), 'không được xóa');
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('should recover safe interrupted publication states and preserve active or ambiguous states', async () => {
  const { firstRoot } = await generationFixture();
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), 'notion-srs-publication-recovery-'),
  );
  const outputRoot = join(temporaryDirectory, 'assets');
  const backupPrefix = '.assets.backup-';
  const firstBackup = join(
    temporaryDirectory,
    `${backupPrefix}${randomUUID()}`,
  );
  await cp(firstRoot, firstBackup, { recursive: true });

  try {
    await recoverAssetPublication(outputRoot);
    assert.deepEqual(await validateGeneratedAssets(outputRoot), []);
    assert.equal(
      (await readdir(temporaryDirectory)).some((name) =>
        name.startsWith(backupPrefix),
      ),
      false,
    );

    const ambiguousBackups = [
      join(temporaryDirectory, `${backupPrefix}${randomUUID()}`),
      join(temporaryDirectory, `${backupPrefix}${randomUUID()}`),
    ] as const;
    await Promise.all(
      ambiguousBackups.map((backup) =>
        cp(outputRoot, backup, { recursive: true }),
      ),
    );
    await assert.rejects(
      recoverAssetPublication(outputRoot),
      /nhiều backup|mơ hồ/iu,
    );
    for (const backup of ambiguousBackups) {
      assert.deepEqual(await validateGeneratedAssets(backup), []);
      await rm(backup, { recursive: true });
    }

    const journalBackup = join(
      temporaryDirectory,
      `${backupPrefix}${randomUUID()}`,
    );
    const journalStaging = join(
      temporaryDirectory,
      `.assets.staging-${randomUUID()}`,
    );
    await rename(outputRoot, journalBackup);
    await cp(journalBackup, journalStaging, { recursive: true });
    await writeFile(
      join(temporaryDirectory, '.assets.publish.json'),
      `${JSON.stringify({
        version: 1,
        outputRoot,
        stagingRoot: journalStaging,
        backupRoot: journalBackup,
        ownerPid: 2_147_483_647,
        createdAt: Date.now(),
        phase: 'backup-created',
      })}\n`,
      'utf8',
    );
    await recoverAssetPublication(outputRoot);
    assert.deepEqual(await validateGeneratedAssets(outputRoot), []);
    assert.deepEqual((await readdir(temporaryDirectory)).sort(), ['assets']);

    const orphanStaging = join(
      temporaryDirectory,
      `.assets.staging-${randomUUID()}`,
    );
    await rename(outputRoot, orphanStaging);
    await recoverAssetPublication(outputRoot);
    assert.deepEqual(await validateGeneratedAssets(outputRoot), []);
    assert.deepEqual((await readdir(temporaryDirectory)).sort(), ['assets']);

    const combinedOrphanBackup = join(
      temporaryDirectory,
      `${backupPrefix}${randomUUID()}`,
    );
    const combinedOrphanStaging = join(
      temporaryDirectory,
      `.assets.staging-${randomUUID()}`,
    );
    await rename(outputRoot, combinedOrphanBackup);
    await cp(combinedOrphanBackup, combinedOrphanStaging, {
      recursive: true,
    });
    await assert.rejects(
      recoverAssetPublication(outputRoot),
      /orphan mơ hồ|backup và staging/iu,
    );
    assert.deepEqual(await validateGeneratedAssets(combinedOrphanBackup), []);
    assert.deepEqual(await validateGeneratedAssets(combinedOrphanStaging), []);
    await rm(combinedOrphanStaging, { recursive: true });
    await rename(combinedOrphanBackup, outputRoot);

    const liveLockPath = join(temporaryDirectory, '.assets.generate.lock');
    await writeFile(
      liveLockPath,
      `${JSON.stringify({
        version: 1,
        outputRoot,
        ownerPid: process.pid,
        createdAt: Date.now(),
      })}\n`,
      'utf8',
    );
    await assert.rejects(
      recoverAssetPublication(outputRoot),
      /đang hoạt động|publication in progress/iu,
    );
    assert.equal((await readdir(temporaryDirectory)).includes('assets'), true);
    await rm(liveLockPath);

    const ambiguousBackup = join(
      temporaryDirectory,
      `${backupPrefix}${randomUUID()}`,
    );
    const ambiguousStaging = join(
      temporaryDirectory,
      `.assets.staging-${randomUUID()}`,
    );
    await Promise.all([
      cp(outputRoot, ambiguousBackup, { recursive: true }),
      cp(outputRoot, ambiguousStaging, { recursive: true }),
    ]);
    const journalPath = join(temporaryDirectory, '.assets.publish.json');
    await writeFile(
      journalPath,
      `${JSON.stringify({
        version: 1,
        outputRoot,
        stagingRoot: ambiguousStaging,
        backupRoot: ambiguousBackup,
        ownerPid: 2_147_483_647,
        createdAt: Date.now(),
        phase: 'published',
      })}\n`,
      'utf8',
    );
    await assert.rejects(
      recoverAssetPublication(outputRoot),
      /mơ hồ.*output.*staging.*backup/iu,
    );
    assert.deepEqual(await validateGeneratedAssets(outputRoot), []);
    assert.deepEqual(await validateGeneratedAssets(ambiguousBackup), []);
    assert.deepEqual(await validateGeneratedAssets(ambiguousStaging), []);
    await Promise.all([
      rm(ambiguousBackup, { recursive: true }),
      rm(ambiguousStaging, { recursive: true }),
      rm(journalPath),
    ]);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
