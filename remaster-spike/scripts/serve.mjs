// A Cloudflare-Workers-Static-Assets-like server for local measurement.
//   node scripts/serve.mjs <root> <port>
// - Brotli (quality 5, cached per file) for text types, like CDN on-the-fly
//   compression; binary vector tiles are sent uncompressed (conservative).
// - Ignores Range (always 200 + whole file), as Workers Static Assets does.
// - /a/b resolves to a/b, a/b.html or a/b/index.html; misses serve 404.html.
// - GET /__stats returns bytes sent per request since the last ?reset=1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 4400);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.pbf': 'application/x-protobuf', '.woff2': 'font/woff2',
};
const COMPRESS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.geojson', '.svg', '.txt', '.xml']);
const brCache = new Map();
let log = [];

const resolve = (pathname) => {
  const clean = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const c of [clean, `${clean}.html`, path.join(clean, 'index.html')]) {
    const f = path.join(root, c);
    if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__stats') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(log));
    if (url.searchParams.has('reset')) log = [];
    return;
  }
  if (url.pathname === '/api/feedback') {
    res.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end('{"message":"Feedback is unavailable in local preview"}');
  }
  let file = resolve(url.pathname);
  let status = 200;
  if (!file) { file = path.join(root, '404.html'); status = 404; }
  const ext = path.extname(file);
  const hashed = /\/(_astro|_next\/static|data\/years|data\/historical|data\/context)\//.test(url.pathname);
  const headers = {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    'access-control-allow-origin': '*',
  };
  let body = fs.readFileSync(file);
  if (COMPRESS.has(ext) && /\bbr\b/.test(req.headers['accept-encoding'] || '')) {
    let c = brCache.get(file);
    if (!c) { c = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }); brCache.set(file, c); }
    body = c;
    headers['content-encoding'] = 'br';
  }
  headers['content-length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
  log.push({ path: url.pathname, status, bytes: body.length, ext, t: Date.now() });
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
