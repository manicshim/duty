const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 5050);
const apiTarget = new URL(process.env.API_TARGET || 'http://127.0.0.1:3300');
const distDir = path.join(__dirname, 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function proxyApi(req, res) {
  const headers = { ...req.headers, host: apiTarget.host };
  const proxy = http.request(
    {
      protocol: apiTarget.protocol,
      hostname: apiTarget.hostname,
      port: apiTarget.port,
      method: req.method,
      path: req.url.replace(/^\/api(?=\/|$)/, '') || '/',
      headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    },
  );

  proxy.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'API unavailable' }));
  });
  req.pipe(proxy);
}

function serveFile(filePath, res) {
  fs.stat(filePath, (error, stat) => {
    const target = !error && stat.isFile() ? filePath : path.join(distDir, 'index.html');
    fs.readFile(target, (readError, body) => {
      if (readError) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Web build not found. Run npm run build.');
        return;
      }
      res.writeHead(200, {
        'content-type': contentTypes[path.extname(target)] || 'application/octet-stream',
        'cache-control': target.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(body);
    });
  });
}

http.createServer((req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }

  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(distDir, relativePath);
  serveFile(filePath.startsWith(`${distDir}${path.sep}`) ? filePath : path.join(distDir, 'index.html'), res);
}).listen(port, '127.0.0.1');
