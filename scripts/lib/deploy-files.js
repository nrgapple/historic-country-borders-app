const fs = require('fs');
const path = require('path');

/**
 * Cloudflare Workers Static Assets limits on the Free plan (checked
 * 2026-11-17, REMASTER_PLAN §3.2): 20,000 files per Worker version and
 * 25 MiB per file. The CI budget stays below the hard limit (§5).
 */
const CLOUDFLARE_FREE_FILE_LIMIT = 20_000;
const CLOUDFLARE_FREE_FILE_BYTES = 25 * 1024 * 1024;
const FILE_COUNT_BUDGET = 16_000;

// Wrangler reads these as configuration; they are not uploaded as assets.
const CONFIG_FILES = new Set(['_headers', '_redirects', '.assetsignore']);

const globToRegExp = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/^\//, '')
      .replace(/\/$/, '/**')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\u0000/g, '.*')}$`,
  );

/** Lists the files `wrangler deploy` would upload from an assets directory. */
function listDeployableFiles(directory) {
  const ignoreFile = path.join(directory, '.assetsignore');
  const ignored = fs.existsSync(ignoreFile)
    ? fs
        .readFileSync(ignoreFile, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map(globToRegExp)
    : [];
  const walk = (current) =>
    fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(current, entry.name);
      return entry.isDirectory() ? walk(entryPath) : [entryPath];
    });
  return walk(directory)
    .map((file) => ({
      file: path.relative(directory, file).split(path.sep).join('/'),
      bytes: fs.statSync(file).size,
    }))
    .filter(
      ({ file }) =>
        !CONFIG_FILES.has(file) &&
        !ignored.some((pattern) => pattern.test(file)),
    );
}

/** Returns budget errors for a deployable directory (empty when within). */
function checkDeployableFiles(directory, budgets = {}) {
  const maxFiles = budgets.maxFiles ?? FILE_COUNT_BUDGET;
  const maxFileBytes = budgets.maxFileBytes ?? CLOUDFLARE_FREE_FILE_BYTES;
  const files = listDeployableFiles(directory);
  const errors = [];
  if (files.length > maxFiles) {
    errors.push(
      `Deployable files: ${files.length} exceeds the budget of ${maxFiles} (Cloudflare Free limit ${CLOUDFLARE_FREE_FILE_LIMIT})`,
    );
  }
  for (const { file, bytes } of files) {
    if (bytes > maxFileBytes) {
      errors.push(
        `Deployable file ${file}: ${(bytes / 1024 / 1024).toFixed(1)} MiB exceeds ${(maxFileBytes / 1024 / 1024).toFixed(0)} MiB`,
      );
    }
  }
  const largest = files.reduce(
    (max, entry) => (entry.bytes > max.bytes ? entry : max),
    { file: '', bytes: 0 },
  );
  return { count: files.length, largest, errors, maxFiles };
}

module.exports = {
  CLOUDFLARE_FREE_FILE_LIMIT,
  CLOUDFLARE_FREE_FILE_BYTES,
  FILE_COUNT_BUDGET,
  checkDeployableFiles,
  listDeployableFiles,
};
