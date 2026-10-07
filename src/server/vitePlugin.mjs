import { handleApiRequest } from './apiHandler.mjs';

/**
 * Vite Plugin that intercepts /api requests in the dev server
 * and handles them with the SQLite database.
 * No separate server process needed during development!
 */
export function sqliteApiPlugin() {
  return {
    name: 'sqlite-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/') || req.url === '/api')) {
          try {
            await handleApiRequest(req, res);
          } catch (err) {
            console.error('[Vite SQLite API Error]:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
        next();
      });
    },
  };
}
