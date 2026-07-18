import { readdir } from 'node:fs/promises';

const TEST_DIRECTORY_URL = new URL('./notion-srs-wireframes/', import.meta.url);
const testFilenames = (
  await readdir(TEST_DIRECTORY_URL, { withFileTypes: true })
)
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => entry.name)
  .sort();

if (testFilenames.length === 0) {
  throw new Error('No direct-child notion SRS wireframe tests were discovered');
}

for (const filename of testFilenames) {
  await import(new URL(filename, TEST_DIRECTORY_URL).href);
}
