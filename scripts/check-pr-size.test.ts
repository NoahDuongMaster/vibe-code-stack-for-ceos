import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPullRequestSizeViolations,
  parseGitNumstat,
} from './check-pr-size.ts';

test('should count text and binary files from git numstat', () => {
  assert.deepEqual(
    parseGitNumstat(
      '10\t2\tsrc/a.ts\n-\t-\tpublic/image.png\n3\t0\tsrc/b.ts\n',
    ),
    { additions: 13, deletions: 2, files: 3 },
  );
});

test('should accept a pull request at both configured limits', () => {
  assert.deepEqual(
    getPullRequestSizeViolations(
      { additions: 12_000, deletions: 8_000, files: 150 },
      { maxChangedFiles: 150, maxChangedLines: 20_000 },
    ),
    [],
  );
});

test('should report file and line violations independently', () => {
  assert.deepEqual(
    getPullRequestSizeViolations(
      { additions: 20_000, deletions: 1, files: 151 },
      { maxChangedFiles: 150, maxChangedLines: 20_000 },
    ),
    [
      '151 changed files exceeds the 150-file limit',
      '20001 changed lines exceeds the 20000-line limit',
    ],
  );
});
