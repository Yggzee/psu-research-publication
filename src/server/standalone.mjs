import http from 'node:http';
import { handleApiRequest } from './apiHandler.mjs';

const PORT = parseInt(process.env.API_PORT || '8000', 10);

const server = http.createServer(async (req, res) => {
  if (req.url && (req.url.startsWith('/api/') || req.url === '/api')) {
    await handleApiRequest(req, res);
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Research Database API Server] Running on http://localhost:${PORT}`);
  console.log(`[Database File] data/research.db`);
});
