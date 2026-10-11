import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiHandler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../../dist');
const PORT = parseInt(process.env.PORT || process.env.API_PORT || '8080', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Route API requests to API handler
  if (pathname.startsWith('/api/') || pathname === '/api') {
    return handleApiRequest(req, res);
  }

  // 2. Serve static frontend assets from dist/
  let filePath = path.join(DIST_DIR, pathname);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  // Check if file exists
  let stat;
  try {
    stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.statSync(filePath);
    }
  } catch {
    // If static file doesn't exist, fallback to index.html for SPA client-side routing
    filePath = path.join(DIST_DIR, 'index.html');
    try {
      stat = fs.statSync(filePath);
    } catch {
      res.statusCode = 404;
      return res.end('Frontend build not found. Did you run npm run build?');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);

  // Cache static assets aggressively, but not index.html
  if (pathname.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    res.statusCode = 500;
    res.end('Server Error');
  });
  stream.pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Research Tracking Production Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Static Files] Serving from: ${DIST_DIR}`);
});
