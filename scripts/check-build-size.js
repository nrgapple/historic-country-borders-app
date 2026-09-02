const fs = require('fs');
const path = require('path');

const chunksDirectory = path.join(__dirname, '../.next/static/chunks');
const MAX_TOTAL_JS_BYTES = 5 * 1024 * 1024;
const MAX_CHUNK_BYTES = 1600 * 1024;

if (!fs.existsSync(chunksDirectory)) {
  console.error('Missing .next build output. Run `yarn build` first.');
  process.exit(1);
}

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });

const files = walk(chunksDirectory)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({
    file: path.relative(path.join(__dirname, '..'), file),
    bytes: fs.statSync(file).size,
  }))
  .sort((a, b) => b.bytes - a.bytes);

const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
const oversizedChunks = files.filter((file) => file.bytes > MAX_CHUNK_BYTES);
const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const summary = [
  '## JavaScript build-size budget',
  '',
  `- Total chunks: ${formatKiB(totalBytes)} / ${formatKiB(MAX_TOTAL_JS_BYTES)}`,
  `- Largest chunk: ${files[0] ? formatKiB(files[0].bytes) : 'n/a'} / ${formatKiB(MAX_CHUNK_BYTES)}`,
  `- Chunk count: ${files.length}`,
];

console.log(summary.slice(2).join('\n'));
console.log('\nLargest chunks:');
files.slice(0, 5).forEach(({ file, bytes }) => {
  console.log(`- ${formatKiB(bytes)} ${file}`);
});

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
}

if (totalBytes > MAX_TOTAL_JS_BYTES) {
  console.error(
    `Total JavaScript exceeds the ${formatKiB(MAX_TOTAL_JS_BYTES)} budget.`,
  );
  process.exitCode = 1;
}

if (oversizedChunks.length > 0) {
  console.error(
    `Chunks exceeding ${formatKiB(MAX_CHUNK_BYTES)}:\n${oversizedChunks
      .map(({ file, bytes }) => `- ${formatKiB(bytes)} ${file}`)
      .join('\n')}`,
  );
  process.exitCode = 1;
}
