// A local server that behaves like Workers Static Assets for preview and e2e:
//   node scripts/serve.mjs <root> <port>
// - /a/b resolves to a/b, a/b.html or a/b/index.html; misses serve 404.html
//   with status 404 (not_found_handling = "404-page").
// - Brotli (quality 5, cached per file) for text types, like on-the-fly CDN
//   compression; Range is ignored (always 200 and the whole file).
// - /api/feedback answers 503: the Worker route is not part of the static
//   preview.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 4410);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pbf': 'application/x-protobuf',
  '.woff2': 'font/woff2',
};
const COMPRESS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.geojson',
  '.svg',
  '.txt',
  '.xml',
  '.pbf',
]);
const IMMUTABLE = /^\/(_astro|data\/years|data\/context)\//;
const brCache = new Map();

const resolve = (pathname) => {
  let clean;
  try {
    clean = path
      .normalize(decodeURIComponent(pathname))
      .replace(/^(\.\.[/\\])+/, '');
  } catch {
    return null;
  }
  for (const candidate of [
    clean,
    `${clean}.html`,
    path.join(clean, 'index.html'),
  ]) {
    const file = path.join(root, candidate);
    if (
      file.startsWith(root) &&
      fs.existsSync(file) &&
      fs.statSync(file).isFile()
    )
      return file;
  }
  return null;
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/feedback') {
      res.writeHead(503, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(
        JSON.stringify({
          message: 'Feedback is unavailable in local static preview',
        }),
      );
      return;
    }
    let file = resolve(url.pathname);
    let status = 200;
    if (!file) {
      file = path.join(root, '404.html');
      status = 404;
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end('Build not found. Run yarn build.');
      return;
    }
    const ext = path.extname(file);
    const headers = {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': IMMUTABLE.test(url.pathname)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
      'x-content-type-options': 'nosniff',
    };
    let body = fs.readFileSync(file);
    if (
      COMPRESS.has(ext) &&
      /\bbr\b/.test(req.headers['accept-encoding'] || '')
    ) {
      // Keyed by mtime so a rebuild is served without restarting.
      const key = `${file}:${fs.statSync(file).mtimeMs}`;
      let compressed = brCache.get(key);
      if (!compressed) {
        compressed = zlib.brotliCompressSync(body, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
        });
        brCache.set(key, compressed);
      }
      body = compressed;
      headers['content-encoding'] = 'br';
    }
    headers['content-length'] = body.length;
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`Preview: http://127.0.0.1:${port}`),
  );
