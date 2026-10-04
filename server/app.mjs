import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { handleSharedAlbumRequest } from './sharedAlbumProxy.mjs';
import { isValidSessionSecret, sessionStorageId } from './crypto.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** Pairing codes are requested from Google; cap how fast one address can ask. */
const CONNECT_LIMIT = 10;
const CONNECT_WINDOW_MS = 10 * 60 * 1000;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function createHandler({ sessions, allowedOrigins = [], distDir, now = () => Date.now() }) {
  const connectAttempts = new Map();

  function rateLimited(ip) {
    const cutoff = now() - CONNECT_WINDOW_MS;
    const recent = (connectAttempts.get(ip) ?? []).filter((t) => t > cutoff);
    recent.push(now());
    connectAttempts.set(ip, recent);
    return recent.length > CONNECT_LIMIT;
  }

  async function serveStatic(res, pathname) {
    if (!distDir) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(distDir, safePath);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    } catch {
      filePath = join(distDir, 'index.html'); // SPA fallback
    }
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('The app is not built yet. Run "npm run build" first, or use "npm run dev".');
    }
  }

  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;

    // Cross-origin only for known front ends: the GitHub Pages site and local
    // development. Anything else gets no CORS headers, so browsers refuse it.
    const origin = req.headers.origin?.replace(/\/$/, '');
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Frame-Session');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    try {
      if (pathname === '/healthz') return sendJson(res, 200, { ok: true });

      if (pathname === '/api/fetch-shared-album' && req.method === 'GET') {
        return handleSharedAlbumRequest(req, res);
      }

      if (pathname.startsWith('/api/ambient/')) {
        const secret = req.headers['x-frame-session'];
        if (!isValidSessionSecret(secret)) {
          return sendJson(res, 400, { error: 'Missing or invalid X-Frame-Session header' });
        }
        const id = sessionStorageId(secret);
        const route = `${req.method} ${pathname}`;

        if (route === 'GET /api/ambient/status') return sendJson(res, 200, await sessions.status(id));
        if (route === 'GET /api/ambient/media') return sendJson(res, 200, await sessions.media(id));
        if (route === 'POST /api/ambient/disconnect') return sendJson(res, 200, await sessions.disconnect(id));
        if (route === 'POST /api/ambient/connect') {
          const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
          if (rateLimited(ip)) return sendJson(res, 429, { error: 'Too many pairing attempts. Try again in a few minutes.' });
          return sendJson(res, 200, await sessions.connect(id));
        }
        return sendJson(res, 404, { error: `Unknown endpoint ${pathname}` });
      }

      if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: `Unknown endpoint ${pathname}` });

      await serveStatic(res, pathname);
    } catch (err) {
      console.error('[helper]', err);
      sendJson(res, 500, { error: 'The photo service hit an error. Try again shortly.' });
    }
  };
}
