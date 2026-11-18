const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..', 'out');
const portArgument = process.argv.findIndex(
  (argument) => argument === '-p' || argument === '--port',
);
const port = Number(
  portArgument >= 0 ? process.argv[portArgument + 1] : process.env.PORT || 3000,
);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((request, response) => {
  const url = new URL(
    request.url,
    `http://${request.headers.host || 'localhost'}`,
  );
  if (url.pathname === '/api/feedback') {
    response.writeHead(503, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(
      JSON.stringify({
        message: 'Feedback is unavailable in local static preview',
      }),
    );
    return;
  }

  let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!relative) relative = 'index.html';
  const candidates = [
    relative,
    `${relative}.html`,
    path.join(relative, 'index.html'),
  ];
  let file = candidates
    .map((candidate) => path.resolve(root, candidate))
    .find((candidate) => {
      return (
        candidate.startsWith(`${root}${path.sep}`) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      );
    });
  let status = 200;
  if (!file) {
    file = path.join(root, '404.html');
    status = 404;
  }
  if (!fs.existsSync(file)) {
    response.writeHead(404);
    response.end('Static export not found. Run yarn build.');
    return;
  }
  response.writeHead(status, {
    'Content-Type':
      contentTypes[path.extname(file)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () =>
  console.log(`Static preview: http://127.0.0.1:${port}`),
);
