import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TPullRequestSize {
  additions: number;
  deletions: number;
  files: number;
}

export interface TPullRequestSizeLimits {
  maxChangedFiles: number;
  maxChangedLines: number;
}

export const parseGitNumstat = (output: string): TPullRequestSize => {
  let additions = 0;
  let deletions = 0;
  let files = 0;

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;

    const [added = '-', deleted = '-'] = line.split('\t', 3);
    additions += added === '-' ? 0 : Number.parseInt(added, 10);
    deletions += deleted === '-' ? 0 : Number.parseInt(deleted, 10);
    files += 1;
  }

  return { additions, deletions, files };
};

export const getPullRequestSizeViolations = (
  size: TPullRequestSize,
  limits: TPullRequestSizeLimits,
): string[] => {
  const changedLines = size.additions + size.deletions;
  const violations: string[] = [];

  if (size.files > limits.maxChangedFiles) {
    violations.push(
      `${size.files} changed files exceeds the ${limits.maxChangedFiles}-file limit`,
    );
  }
  if (changedLines > limits.maxChangedLines) {
    violations.push(
      `${changedLines} changed lines exceeds the ${limits.maxChangedLines}-line limit`,
    );
  }

  return violations;
};

const readPositiveInteger = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const assertCommitSha = (value: string, name: string): void => {
  if (!/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error(`${name} must be a full 40-character Git commit SHA`);
  }
};

const main = (): void => {
  const [baseSha, headSha] = process.argv.slice(2);
  if (!baseSha || !headSha) {
    throw new Error(
      'Usage: node scripts/check-pr-size.ts <base-sha> <head-sha>',
    );
  }
  assertCommitSha(baseSha, 'base-sha');
  assertCommitSha(headSha, 'head-sha');

  const output = execFileSync(
    'git',
    ['diff', '--numstat', '--find-renames', `${baseSha}...${headSha}`],
    { encoding: 'utf8' },
  );
  const size = parseGitNumstat(output);
  const limits = {
    maxChangedFiles: readPositiveInteger('MAX_PR_CHANGED_FILES', 150),
    maxChangedLines: readPositiveInteger('MAX_PR_CHANGED_LINES', 20_000),
  };
  const violations = getPullRequestSizeViolations(size, limits);
  const changedLines = size.additions + size.deletions;

  process.stdout.write(
    `PR scope: ${size.files} files, +${size.additions}/-${size.deletions} (${changedLines} changed lines)\n`,
  );
  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(`::error::${violation}\n`);
    }
    process.stderr.write(
      'Split the PR, or add the large-change-reviewed label after explicit human scope review.\n',
    );
    process.exitCode = 1;
  }
};

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
