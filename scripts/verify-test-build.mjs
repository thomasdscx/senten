import { readdir } from 'node:fs/promises';

const dir = new URL('../dist/tests/', import.meta.url);
let files = [];
try {
  files = (await readdir(dir)).filter((name) => name.endsWith('.test.js'));
} catch {
  // handled below
}
if (files.length === 0) {
  console.error('No compiled test files found in dist/tests. The test suite cannot be considered a pass.');
  process.exit(1);
}
console.log(`Compiled test files: ${files.length}`);
