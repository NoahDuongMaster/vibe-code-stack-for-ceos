import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { auditSceneAccessibility } from './accessibility-audit.ts';
import { PLUS_JAKARTA_BASE64 } from './font.ts';
import { auditScreenGeometry } from './geometry-audit.ts';
import { layoutScreen } from './layout-recipes.ts';
import { auditVietnameseScreenContracts } from './localization-policy.ts';
import {
  MOCKUP_TARGETS,
  UI_WIREFRAME_PAGES,
  WIREFRAME_TARGETS,
} from './manifest.ts';
import { renderMockup } from './mockup-renderer.ts';
import { rasterizeSvg } from './rasterize.ts';
import {
  auditScreenContractRuntime,
  SCREEN_CONTRACTS,
} from './screen-contracts.ts';
import type {
  TLayoutRecipe,
  TScreenContract,
  TScreenVisualTarget,
} from './types.ts';
import { validateGeneratedAssets } from './validate.ts';
import { renderWireframe } from './wireframe-renderer.ts';

const RASTER_CONCURRENCY = 4;
const PUBLICATION_JOURNAL_VERSION = 1;
const GENERATION_LOCK_VERSION = 1;

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

const PRE_RASTER_AUDITS = Object.freeze([
  'contract',
  'localization',
  'geometry',
  'accessibility',
] as const);

type TPreparedAsset = Readonly<{
  target: TScreenVisualTarget;
  directory: 'wireframes' | 'mockups';
  svg: string;
}>;

export type TGenerationReport = Readonly<{
  wireframes: number;
  mockups: number;
  preRasterAudits: typeof PRE_RASTER_AUDITS;
  preRasterAuditErrors: readonly string[];
}>;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const screenByCode = new Map(
  SCREEN_CONTRACTS.map((screen) => [screen.code, screen] as const),
);

const requireScreen = (target: TScreenVisualTarget): TScreenContract => {
  const screen = screenByCode.get(target.screenCode);
  if (!screen) {
    throw new Error(`${target.filename}: không tìm thấy screen contract`);
  }
  return screen;
};

const renderReviewControls = (
  name: string,
): string => `<fieldset class="review-controls">
  <legend>Chế độ kích thước duyệt</legend>
  <label><input name="${escapeHtml(name)}" type="radio" value="fit" checked> Vừa chiều rộng</label>
  <label><input name="${escapeHtml(name)}" type="radio" value="100"> 100% pixel</label>
</fieldset>`;

const sharedContactSheetStyles = `
    :root { color-scheme: light; font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1d1018; background: #fff9f8; }
    .page-shell { width: min(100% - 48px, 1500px); margin: 0 auto; padding: 40px 0 72px; }
    h1 { margin: 0 0 8px; font-size: 32px; line-height: 1.25; }
    .intro { max-width: 78ch; margin: 0 0 24px; color: #5f5a63; line-height: 1.6; }
    .review-controls { display: flex; flex-wrap: wrap; gap: 12px 24px; margin: 0 0 32px; padding: 16px 20px; border: 1px solid #d8c9cc; border-radius: 10px; background: #fffdfb; }
    .review-controls legend { padding: 0 8px; font-weight: 700; }
    .review-controls label { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; }
    .review-controls input { width: 20px; height: 20px; accent-color: #e9486a; }
    section { margin: 0 0 48px; }
    .review-grid { display: grid; gap: 28px; }
    article { min-width: 0; overflow: hidden; border: 1px solid #d8c9cc; border-radius: 10px; background: #fffdfb; box-shadow: 0 8px 24px rgb(162 28 56 / 8%); }
    article > header { padding: 20px 22px 0; }
    h2, h3 { line-height: 1.35; }
    h2 { margin: 0 0 18px; font-size: 26px; }
    h3 { margin: 0 0 8px; font-size: 20px; }
    .metadata { margin: 0; color: #5f5a63; line-height: 1.6; }
    figure { margin: 18px 0 0; }
    .image-stage { overflow: auto; border-block: 1px solid #eadde0; background: #f4efef; }
    img { display: block; height: auto; background: #fff; }
    figcaption { padding: 14px 22px 18px; color: #5f5a63; line-height: 1.55; }
    body:has(input[value="fit"]:checked) img { width: 100%; max-width: 100%; }
    body:has(input[value="100"]:checked) img { width: 3840px; max-width: none; }
    code { color: #8a2038; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    @media (max-width: 720px) { .page-shell { width: min(100% - 24px, 1500px); padding-top: 24px; } }
`;

const renderWireframeCard = (
  target: TScreenVisualTarget,
  screen: TScreenContract,
): string => `<article data-screen-code="${escapeHtml(screen.code)}">
  <header>
    <h3>${escapeHtml(screen.code)} — ${escapeHtml(screen.displayTitle)}</h3>
    <p class="metadata">Bố cục: ${escapeHtml(RECIPE_LABELS[screen.layoutRecipe])} · Số component: ${screen.components.length} · <code>${escapeHtml(target.filename)}</code></p>
  </header>
  <figure>
    <div class="image-stage"><img src="./wireframes/${escapeHtml(target.filename)}" width="3840" height="2880" loading="lazy" alt="${escapeHtml(target.alt)}"></div>
    <figcaption>${escapeHtml(target.caption)}</figcaption>
  </figure>
</article>`;

const renderWireframeContactSheet = (): string => {
  const groups = UI_WIREFRAME_PAGES.map((page) => {
    const cards = page.screenCodes
      .map((code) => {
        const target = WIREFRAME_TARGETS.find(
          (candidate) => candidate.screenCode === code,
        );
        if (!target) throw new Error(`${code}: thiếu wireframe target`);
        return renderWireframeCard(target, requireScreen(target));
      })
      .join('\n');
    return `<section data-page-label="${escapeHtml(page.pageLabel)}">
  <h2>${escapeHtml(page.pageLabel)} — ${escapeHtml(page.title)}</h2>
  <div class="review-grid">${cards}</div>
</section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bộ duyệt Wireframe SRS Affiliate Benadep</title>
  <style>${sharedContactSheetStyles}
    .review-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 620px), 1fr)); }
  </style>
</head>
<body>
  <div class="page-shell">
    <header><h1>Bộ duyệt wireframe SRS Affiliate Benadep</h1><p class="intro">59 màn hình được nhóm theo 12 trang đặc tả UI. Dùng chế độ vừa chiều rộng để rà tổng thể và 100% pixel để kiểm tra độ nét, chữ tiếng Việt, clipping và component contract.</p></header>
    ${renderReviewControls('wireframe-review-size')}
    <main>${groups}</main>
  </div>
</body>
</html>
`;
};

const renderMockupCard = (
  target: TScreenVisualTarget,
  screen: TScreenContract,
): string => `<article data-screen-code="${escapeHtml(screen.code)}">
  <header>
    <h2>${escapeHtml(screen.code)} — ${escapeHtml(screen.displayTitle)}</h2>
    <p class="metadata">Trang ${escapeHtml(target.pageLabel)} · Mockup high-fidelity Benadep · <code>${escapeHtml(target.filename)}</code></p>
  </header>
  <figure>
    <div class="image-stage"><img src="./mockups/${escapeHtml(target.filename)}" width="3840" height="2880" loading="lazy" alt="${escapeHtml(target.alt)}"></div>
    <figcaption>${escapeHtml(target.caption)}</figcaption>
  </figure>
</article>`;

const renderMockupContactSheet = (): string => {
  const cards = MOCKUP_TARGETS.map((target) =>
    renderMockupCard(target, requireScreen(target)),
  ).join('\n');
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bộ duyệt Mockup SRS Affiliate Benadep</title>
  <style>${sharedContactSheetStyles}
    .review-grid { grid-template-columns: minmax(0, 1fr); }
  </style>
</head>
<body>
  <div class="page-shell">
    <header><h1>Bộ duyệt mockup high-fidelity SRS Affiliate Benadep</h1><p class="intro">12 màn hình đại diện theo visual system Benadep Luxury Blush. Kiểm tra ở chế độ vừa chiều rộng trước, sau đó chuyển sang 100% pixel để rà từng chi tiết ở đúng độ phân giải 3840×2880.</p></header>
    ${renderReviewControls('mockup-review-size')}
    <main class="review-grid">${cards}</main>
  </div>
</body>
</html>
`;
};

const prefixErrors = (
  audit: string,
  owner: string,
  errors: readonly string[],
): string[] => errors.map((error) => `${audit}/${owner}: ${error}`);

// Several normative binding paths end in `/*`. Encoding only the slash keeps
// the visible text byte-for-byte equivalent after XML parsing while ensuring
// the pinned rasterizer cannot interpret the copy as a CSS comment opener.
const encodeCommentLikeVisibleCopy = (svg: string): string =>
  svg.replaceAll('/*', '&#47;*').replaceAll('*/', '*&#47;');

const prepareAssets = (): Readonly<{
  assets: readonly TPreparedAsset[];
  errors: readonly string[];
}> => {
  const errors = [
    ...prefixErrors(
      'contract',
      'screen-contracts',
      auditScreenContractRuntime(SCREEN_CONTRACTS),
    ),
    ...prefixErrors(
      'localization',
      'screen-contracts',
      auditVietnameseScreenContracts(SCREEN_CONTRACTS),
    ),
  ];
  const assets: TPreparedAsset[] = [];

  const prepare = (
    target: TScreenVisualTarget,
    directory: TPreparedAsset['directory'],
  ): void => {
    try {
      const screen = requireScreen(target);
      const fidelity =
        target.kind === 'wireframe' ? 'wireframe' : 'high-fidelity';
      const layout = layoutScreen(screen, fidelity);
      errors.push(
        ...prefixErrors(
          'geometry',
          target.filename,
          auditScreenGeometry(layout),
        ),
      );
      const svg =
        target.kind === 'wireframe'
          ? renderWireframe(screen, layout, PLUS_JAKARTA_BASE64)
          : renderMockup(screen, layout, PLUS_JAKARTA_BASE64);
      errors.push(
        ...prefixErrors(
          'accessibility',
          target.filename,
          auditSceneAccessibility(svg),
        ),
      );
      assets.push(Object.freeze({ target, directory, svg }));
    } catch (error) {
      errors.push(
        `contract/${target.filename}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  for (const target of WIREFRAME_TARGETS) prepare(target, 'wireframes');
  for (const target of MOCKUP_TARGETS) prepare(target, 'mockups');

  return Object.freeze({
    assets: Object.freeze(assets),
    errors: Object.freeze([...new Set(errors)]),
  });
};

const runWithConcurrency = async <T>(
  values: readonly T[],
  concurrency: number,
  run: (value: T) => Promise<void>,
): Promise<void> => {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value !== undefined) await run(value);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () =>
      worker(),
    ),
  );
};

const isMissing = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error as NodeJS.ErrnoException).code === 'ENOENT';

const isAlreadyExists = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error as NodeJS.ErrnoException).code === 'EEXIST';

type TGenerationLock = Readonly<{
  version: typeof GENERATION_LOCK_VERSION;
  outputRoot: string;
  ownerPid: number;
  createdAt: number;
}>;

type TPublicationJournal = Readonly<{
  version: typeof PUBLICATION_JOURNAL_VERSION;
  outputRoot: string;
  stagingRoot: string;
  backupRoot: string;
  ownerPid: number;
  createdAt: number;
  phase: 'prepared' | 'backup-created' | 'published';
}>;

const generationLockPath = (outputRoot: string, outputParent: string): string =>
  join(outputParent, `.${basename(outputRoot)}.generate.lock`);

const publicationJournalPath = (
  outputRoot: string,
  outputParent: string,
): string => join(outputParent, `.${basename(outputRoot)}.publish.json`);

const pathExists = async (pathname: string): Promise<boolean> => {
  try {
    await lstat(pathname);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ESRCH'
    ) {
      return false;
    }
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'EPERM'
    ) {
      return true;
    }
    throw error;
  }
};

const assertJournalPath = (
  pathname: string,
  outputParent: string,
  prefix: string,
): void => {
  if (
    dirname(pathname) !== outputParent ||
    !basename(pathname).startsWith(prefix)
  ) {
    throw new Error(
      `Publication journal chứa đường dẫn không an toàn: ${pathname}`,
    );
  }
};

const listPublicationBackups = async (
  outputRoot: string,
  outputParent: string,
): Promise<readonly string[]> => {
  const prefix = `.${basename(outputRoot)}.backup-`;
  const backups: string[] = [];
  for (const entry of await readdir(outputParent, { withFileTypes: true })) {
    if (!entry.name.startsWith(prefix)) continue;
    const pathname = join(outputParent, entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(
        `Backup publication không phải thư mục thường: ${pathname}`,
      );
    }
    backups.push(pathname);
  }
  return Object.freeze(backups.sort());
};

const listPublicationStaging = async (
  outputRoot: string,
  outputParent: string,
): Promise<readonly string[]> => {
  const prefix = `.${basename(outputRoot)}.staging-`;
  const stagingDirectories: string[] = [];
  for (const entry of await readdir(outputParent, { withFileTypes: true })) {
    if (!entry.name.startsWith(prefix)) continue;
    const pathname = join(outputParent, entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(
        `Staging publication không phải thư mục thường: ${pathname}`,
      );
    }
    stagingDirectories.push(pathname);
  }
  return Object.freeze(stagingDirectories.sort());
};

const syncDirectory = async (pathname: string): Promise<void> => {
  const handle = await open(pathname, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};

const syncGeneratedTree = async (root: string): Promise<void> => {
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name, 'en-US'),
    )) {
      const pathname = join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        await visit(pathname);
      } else if (entry.isFile() && !entry.isSymbolicLink()) {
        const handle = await open(pathname, 'r');
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
      } else {
        throw new Error(
          `Không thể fsync generated tree không an toàn: ${pathname}`,
        );
      }
    }
    await syncDirectory(directory);
  };
  await visit(root);
};

const writeSynchronizedFile = async (
  pathname: string,
  content: string,
  flag: 'w' | 'wx',
): Promise<void> => {
  const handle = await open(pathname, flag, 0o600);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
};

const readGenerationLock = async (
  lockPath: string,
  outputRoot: string,
): Promise<TGenerationLock> => {
  const metadata = await lstat(lockPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Generation lock không phải tệp thường: ${lockPath}`);
  }
  const parsed: unknown = JSON.parse(await readFile(lockPath, 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    parsed.version !== GENERATION_LOCK_VERSION ||
    !('outputRoot' in parsed) ||
    parsed.outputRoot !== outputRoot ||
    !('ownerPid' in parsed) ||
    !Number.isSafeInteger(parsed.ownerPid) ||
    Number(parsed.ownerPid) <= 0 ||
    !('createdAt' in parsed) ||
    !Number.isSafeInteger(parsed.createdAt) ||
    Number(parsed.createdAt) <= 0
  ) {
    throw new Error(`Generation lock không đúng schema/owner: ${lockPath}`);
  }
  return Object.freeze({
    version: GENERATION_LOCK_VERSION,
    outputRoot,
    ownerPid: Number(parsed.ownerPid),
    createdAt: Number(parsed.createdAt),
  });
};

const acquireGenerationLock = async (
  outputDir: string,
): Promise<
  Readonly<{ outputRoot: string; outputParent: string; lockPath: string }>
> => {
  const outputRoot = resolve(outputDir);
  const outputParent = dirname(outputRoot);
  if (outputRoot === outputParent || basename(outputRoot).length === 0) {
    throw new Error('Không được dùng filesystem root làm thư mục asset');
  }
  await mkdir(outputParent, { recursive: true });
  const parent = await lstat(outputParent);
  if (!parent.isDirectory() || parent.isSymbolicLink()) {
    throw new Error('Thư mục cha của output không an toàn');
  }
  const lockPath = generationLockPath(outputRoot, outputParent);
  const lock: TGenerationLock = Object.freeze({
    version: GENERATION_LOCK_VERSION,
    outputRoot,
    ownerPid: process.pid,
    createdAt: Date.now(),
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeSynchronizedFile(lockPath, `${JSON.stringify(lock)}\n`, 'wx');
      await syncDirectory(outputParent);
      return Object.freeze({ outputRoot, outputParent, lockPath });
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const existing = await readGenerationLock(lockPath, outputRoot);
      if (isProcessAlive(existing.ownerPid)) {
        throw new Error(
          `Generation publication đang hoạt động với PID ${existing.ownerPid}`,
        );
      }
      await rm(lockPath);
      await syncDirectory(outputParent);
    }
  }
  throw new Error(`Không thể giành generation lock: ${lockPath}`);
};

const releaseGenerationLock = async (
  lockPath: string,
  outputRoot: string,
  outputParent: string,
): Promise<void> => {
  const lock = await readGenerationLock(lockPath, outputRoot);
  if (lock.ownerPid !== process.pid) {
    throw new Error(
      `Từ chối xóa generation lock của PID khác: ${lock.ownerPid}`,
    );
  }
  await rm(lockPath);
  await syncDirectory(outputParent);
};

const writePublicationJournal = async (
  journalPath: string,
  journal: TPublicationJournal,
  outputParent: string,
  create: boolean,
): Promise<void> => {
  if (create) {
    await writeSynchronizedFile(
      journalPath,
      `${JSON.stringify(journal)}\n`,
      'wx',
    );
  } else {
    const nextPath = `${journalPath}.next-${randomUUID()}`;
    await writeSynchronizedFile(nextPath, `${JSON.stringify(journal)}\n`, 'wx');
    await rename(nextPath, journalPath);
  }
  await syncDirectory(outputParent);
};

const readPublicationJournal = async (
  journalPath: string,
  outputRoot: string,
  outputParent: string,
): Promise<TPublicationJournal | null> => {
  try {
    const metadata = await lstat(journalPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error('Publication journal phải là tệp thường');
    }
    const parsed: unknown = JSON.parse(await readFile(journalPath, 'utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      parsed.version !== PUBLICATION_JOURNAL_VERSION ||
      !('outputRoot' in parsed) ||
      parsed.outputRoot !== outputRoot ||
      !('stagingRoot' in parsed) ||
      typeof parsed.stagingRoot !== 'string' ||
      !('backupRoot' in parsed) ||
      typeof parsed.backupRoot !== 'string' ||
      !('ownerPid' in parsed) ||
      !Number.isSafeInteger(parsed.ownerPid) ||
      Number(parsed.ownerPid) <= 0 ||
      !('createdAt' in parsed) ||
      !Number.isSafeInteger(parsed.createdAt) ||
      Number(parsed.createdAt) <= 0 ||
      !('phase' in parsed) ||
      !['prepared', 'backup-created', 'published'].includes(
        String(parsed.phase),
      )
    ) {
      throw new Error(
        'Publication journal không đúng schema hoặc output owner',
      );
    }
    assertJournalPath(
      parsed.stagingRoot,
      outputParent,
      `.${basename(outputRoot)}.staging-`,
    );
    assertJournalPath(
      parsed.backupRoot,
      outputParent,
      `.${basename(outputRoot)}.backup-`,
    );
    return Object.freeze({
      version: PUBLICATION_JOURNAL_VERSION,
      outputRoot,
      stagingRoot: parsed.stagingRoot,
      backupRoot: parsed.backupRoot,
      ownerPid: Number(parsed.ownerPid),
      createdAt: Number(parsed.createdAt),
      phase: parsed.phase as TPublicationJournal['phase'],
    });
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
};

const requireValidGeneratedDirectory = async (
  pathname: string,
  label: string,
): Promise<void> => {
  const errors = await validateGeneratedAssets(pathname);
  if (errors.length > 0) {
    throw new Error(`${label} không hợp lệ:\n${errors.join('\n')}`);
  }
};

const recoverInterruptedPublication = async (
  outputRoot: string,
  outputParent: string,
): Promise<void> => {
  const journalPath = publicationJournalPath(outputRoot, outputParent);
  const journal = await readPublicationJournal(
    journalPath,
    outputRoot,
    outputParent,
  );
  if (!journal) return;
  if (isProcessAlive(journal.ownerPid)) {
    throw new Error(
      `Publication journal vẫn thuộc publisher đang hoạt động PID ${journal.ownerPid}`,
    );
  }

  const [backupCandidates, stagingCandidates] = await Promise.all([
    listPublicationBackups(outputRoot, outputParent),
    listPublicationStaging(outputRoot, outputParent),
  ]);
  if (
    backupCandidates.length > 1 ||
    (backupCandidates.length === 1 &&
      backupCandidates[0] !== journal.backupRoot)
  ) {
    throw new Error(
      `Publication recovery mơ hồ; giữ nguyên các backup: ${backupCandidates.join(', ')}`,
    );
  }
  if (
    stagingCandidates.length > 1 ||
    (stagingCandidates.length === 1 &&
      stagingCandidates[0] !== journal.stagingRoot)
  ) {
    throw new Error(
      `Publication recovery mơ hồ; giữ nguyên các staging: ${stagingCandidates.join(', ')}`,
    );
  }

  const [hasOutput, hasStaging, hasBackup] = await Promise.all([
    pathExists(outputRoot),
    pathExists(journal.stagingRoot),
    pathExists(journal.backupRoot),
  ]);
  if (hasOutput && hasStaging && hasBackup) {
    throw new Error(
      `Publication recovery mơ hồ ở phase ${journal.phase}; giữ nguyên output, staging và backup`,
    );
  }
  if (hasOutput) {
    await requireValidGeneratedDirectory(
      outputRoot,
      'Output sau publication bị gián đoạn',
    );
    if (hasStaging) {
      await requireValidGeneratedDirectory(
        journal.stagingRoot,
        'Staging bị gián đoạn',
      );
      await rm(journal.stagingRoot, { recursive: true });
    }
    if (hasBackup) {
      await requireValidGeneratedDirectory(
        journal.backupRoot,
        'Backup bị gián đoạn',
      );
      await rm(journal.backupRoot, { recursive: true });
    }
    await rm(journalPath);
    await syncDirectory(outputParent);
    return;
  }

  if (hasBackup) {
    await requireValidGeneratedDirectory(journal.backupRoot, 'Backup phục hồi');
    await rename(journal.backupRoot, outputRoot);
    await requireValidGeneratedDirectory(outputRoot, 'Output đã phục hồi');
    if (hasStaging) {
      await requireValidGeneratedDirectory(
        journal.stagingRoot,
        'Staging bị gián đoạn',
      );
      await rm(journal.stagingRoot, { recursive: true });
    }
    await rm(journalPath);
    await syncDirectory(outputParent);
    return;
  }

  if (hasStaging) {
    await requireValidGeneratedDirectory(
      journal.stagingRoot,
      'Staging phục hồi',
    );
    await rename(journal.stagingRoot, outputRoot);
    await requireValidGeneratedDirectory(outputRoot, 'Output đã phục hồi');
    await rm(journalPath);
    await syncDirectory(outputParent);
    return;
  }

  throw new Error(
    `Publication journal không có output, staging hoặc backup để phục hồi: ${journalPath}`,
  );
};

const recoverOrphanBackup = async (
  outputRoot: string,
  outputParent: string,
): Promise<void> => {
  const backups = await listPublicationBackups(outputRoot, outputParent);
  if (backups.length > 1) {
    throw new Error(
      `Có nhiều backup publication; từ chối tự động phục hồi: ${backups.join(', ')}`,
    );
  }
  const backupRoot = backups[0];
  if (!backupRoot) return;
  await requireValidGeneratedDirectory(backupRoot, 'Backup mồ côi');
  if (await pathExists(outputRoot)) {
    await requireValidGeneratedDirectory(
      outputRoot,
      'Output cạnh backup mồ côi',
    );
    await rm(backupRoot, { recursive: true });
  } else {
    await rename(backupRoot, outputRoot);
    await requireValidGeneratedDirectory(
      outputRoot,
      'Output phục hồi từ backup mồ côi',
    );
  }
  await syncDirectory(outputParent);
};

const recoverOrphanStaging = async (
  outputRoot: string,
  outputParent: string,
): Promise<void> => {
  const stagingDirectories = await listPublicationStaging(
    outputRoot,
    outputParent,
  );
  if (stagingDirectories.length > 1) {
    throw new Error(
      `Có nhiều staging publication; từ chối tự động phục hồi: ${stagingDirectories.join(', ')}`,
    );
  }
  const stagingRoot = stagingDirectories[0];
  if (!stagingRoot) return;
  await requireValidGeneratedDirectory(stagingRoot, 'Staging mồ côi');
  if (await pathExists(outputRoot)) {
    await requireValidGeneratedDirectory(
      outputRoot,
      'Output cạnh staging mồ côi',
    );
    await rm(stagingRoot, { recursive: true });
  } else {
    await rename(stagingRoot, outputRoot);
    await requireValidGeneratedDirectory(
      outputRoot,
      'Output phục hồi từ staging mồ côi',
    );
  }
  await syncDirectory(outputParent);
};

const assertOutputLocation = async (
  outputDir: string,
): Promise<Readonly<{ outputRoot: string; outputParent: string }>> => {
  const outputRoot = resolve(outputDir);
  const outputParent = dirname(outputRoot);
  if (outputRoot === outputParent || basename(outputRoot).length === 0) {
    throw new Error('Không được dùng filesystem root làm thư mục asset');
  }
  await mkdir(outputParent, { recursive: true });
  const parent = await lstat(outputParent);
  if (!parent.isDirectory() || parent.isSymbolicLink()) {
    throw new Error('Thư mục cha của output không an toàn');
  }
  await recoverInterruptedPublication(outputRoot, outputParent);
  const [orphanBackups, orphanStaging] = await Promise.all([
    listPublicationBackups(outputRoot, outputParent),
    listPublicationStaging(outputRoot, outputParent),
  ]);
  if (orphanBackups.length > 0 && orphanStaging.length > 0) {
    throw new Error(
      `Publication orphan mơ hồ; giữ nguyên backup và staging: ${[
        ...orphanBackups,
        ...orphanStaging,
      ].join(', ')}`,
    );
  }
  await recoverOrphanBackup(outputRoot, outputParent);
  await recoverOrphanStaging(outputRoot, outputParent);
  try {
    const current = await lstat(outputRoot);
    if (!current.isDirectory() || current.isSymbolicLink()) {
      throw new Error('Output hiện tại phải là thư mục thường');
    }
    const ownershipErrors = await validateGeneratedAssets(outputRoot);
    if (ownershipErrors.length > 0) {
      throw new Error(
        `Output hiện tại không thuộc bộ asset hợp lệ; từ chối thay thế:\n${ownershipErrors.join('\n')}`,
      );
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  return Object.freeze({ outputRoot, outputParent });
};

export const recoverAssetPublication = async (
  outputDir: string,
): Promise<void> => {
  const lock = await acquireGenerationLock(outputDir);
  try {
    await assertOutputLocation(lock.outputRoot);
  } finally {
    await releaseGenerationLock(
      lock.lockPath,
      lock.outputRoot,
      lock.outputParent,
    );
  }
};

const publishStagingDirectory = async (
  stagingRoot: string,
  outputRoot: string,
  outputParent: string,
): Promise<void> => {
  const backupRoot = join(
    outputParent,
    `.${basename(outputRoot)}.backup-${randomUUID()}`,
  );
  const journalPath = publicationJournalPath(outputRoot, outputParent);
  let journal: TPublicationJournal = Object.freeze({
    version: PUBLICATION_JOURNAL_VERSION,
    outputRoot,
    stagingRoot,
    backupRoot,
    ownerPid: process.pid,
    createdAt: Date.now(),
    phase: 'prepared',
  });
  await writePublicationJournal(journalPath, journal, outputParent, true);
  let hasBackup = false;
  let hasPublished = false;
  try {
    await rename(outputRoot, backupRoot);
    hasBackup = true;
    await syncDirectory(outputParent);
    journal = Object.freeze({ ...journal, phase: 'backup-created' });
    await writePublicationJournal(journalPath, journal, outputParent, false);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  try {
    await rename(stagingRoot, outputRoot);
    hasPublished = true;
    await syncDirectory(outputParent);
    journal = Object.freeze({ ...journal, phase: 'published' });
    await writePublicationJournal(journalPath, journal, outputParent, false);
    await requireValidGeneratedDirectory(outputRoot, 'Output vừa publish');
  } catch (publishError) {
    try {
      if (hasPublished) {
        await rename(outputRoot, stagingRoot);
        hasPublished = false;
      }
      if (hasBackup) {
        await rename(backupRoot, outputRoot);
        hasBackup = false;
        await requireValidGeneratedDirectory(outputRoot, 'Output rollback');
      }
      await rm(journalPath);
      await syncDirectory(outputParent);
    } catch (rollbackError) {
      throw new AggregateError(
        [publishError, rollbackError],
        `Không publish hoặc rollback được ${outputRoot}; bản cũ còn tại ${backupRoot}`,
      );
    }
    throw publishError;
  }
  if (hasBackup) {
    await requireValidGeneratedDirectory(backupRoot, 'Backup trước khi dọn');
    await rm(backupRoot, { recursive: true });
    await syncDirectory(outputParent);
  }
  await rm(journalPath);
  await syncDirectory(outputParent);
};

export const generateAssets = async (
  outputDir: string,
): Promise<TGenerationReport> => {
  const prepared = prepareAssets();
  if (prepared.errors.length > 0) {
    throw new Error(
      `Pre-raster audits thất bại:\n${prepared.errors.join('\n')}`,
    );
  }
  if (
    prepared.assets.length !==
    WIREFRAME_TARGETS.length + MOCKUP_TARGETS.length
  ) {
    throw new Error('Pre-raster asset set không đủ 59 wireframes + 12 mockups');
  }

  const lock = await acquireGenerationLock(outputDir);
  try {
    const { outputRoot, outputParent } = await assertOutputLocation(
      lock.outputRoot,
    );
    const stagingRoot = await mkdtemp(
      join(outputParent, `.${basename(outputRoot)}.staging-`),
    );
    let stagingExists = true;
    try {
      await Promise.all([
        mkdir(join(stagingRoot, 'wireframes')),
        mkdir(join(stagingRoot, 'mockups')),
      ]);
      await runWithConcurrency(
        prepared.assets,
        RASTER_CONCURRENCY,
        async (asset) => {
          await rasterizeSvg(
            encodeCommentLikeVisibleCopy(asset.svg),
            join(stagingRoot, asset.directory, asset.target.filename),
          );
        },
      );
      await Promise.all([
        writeFile(
          join(stagingRoot, 'contact-sheet-wireframes.html'),
          renderWireframeContactSheet(),
          'utf8',
        ),
        writeFile(
          join(stagingRoot, 'contact-sheet-mockups.html'),
          renderMockupContactSheet(),
          'utf8',
        ),
      ]);
      const validationErrors = await validateGeneratedAssets(stagingRoot);
      if (validationErrors.length > 0) {
        throw new Error(
          `Staging asset validation thất bại:\n${validationErrors.join('\n')}`,
        );
      }
      await syncGeneratedTree(stagingRoot);
      await publishStagingDirectory(stagingRoot, outputRoot, outputParent);
      stagingExists = false;
    } finally {
      if (stagingExists) {
        await rm(stagingRoot, { force: true, recursive: true });
      }
    }

    return Object.freeze({
      wireframes: WIREFRAME_TARGETS.length,
      mockups: MOCKUP_TARGETS.length,
      preRasterAudits: PRE_RASTER_AUDITS,
      preRasterAuditErrors: prepared.errors,
    });
  } finally {
    await releaseGenerationLock(
      lock.lockPath,
      lock.outputRoot,
      lock.outputParent,
    );
  }
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  const outputDir = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(process.cwd(), 'docs/superpowers/assets/notion-srs-wireframes');
  const report = await generateAssets(outputDir);
  process.stdout.write(
    `${report.wireframes} wireframes + ${report.mockups} mockups generated\n`,
  );
}
