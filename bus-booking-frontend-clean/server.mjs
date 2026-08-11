import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/') pathname = '/index.html';

    const candidate = path.normalize(path.join(__dirname, pathname));
    if (!candidate.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let file = candidate;
    try {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) file = path.join(file, 'index.html');
    } catch {
      // Single-page fallback so refreshes still work.
      file = path.join(__dirname, 'index.html');
    }

    const data = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`\nBus Booking Frontend`);
  console.log(`Local:   http://localhost:${port}`);
  console.log(`Backend: http://127.0.0.1:8000/api/v1`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
