import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { handleSharedAlbumRequest } from './sharedAlbum.mjs';
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
/** Each send attempt is a guess at a TV's code, so it gets the same cap. */
const SEND_LIMIT = 10;
/** Video troubleshooting reports: one per video, so a generous cap. */
const REPORT_LIMIT = 120;

/**
 * Keeps a troubleshooting report to plain facts: numbers, short words and
 * nested lists of them. Anything that looks like a link is removed, so no
 * album or media address can end up in the log.
 */
export function sanitizeReport(value, depth = 0) {
  if (depth > 4) return null;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'string') return value.replace(/https?:\/\/\S+/g, '[link]').slice(0, 300);
  if (Array.isArray(value)) return value.slice(0, 40).map((v) => sanitizeReport(v, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([k, v]) => [k.slice(0, 40), sanitizeReport(v, depth + 1)])
    );
  }
  return null;
}

/**
 * The caller's address, for rate limiting. Behind Cloud Run the socket is the
 * front end, which appends the real address to X-Forwarded-For; everything
 * before that entry came from the caller and can be forged. Without a proxy
 * the header is ignored entirely.
 */
export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const hops = String(req.headers['x-forwarded-for'] ?? '').split(',').map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function readJsonBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function createHandler({ sessions, inbox, allowedOrigins = [], distDir, trustProxy = false, now = () => Date.now() }) {
  function limiter(limit) {
    const attempts = new Map();
    return (ip) => {
      const cutoff = now() - CONNECT_WINDOW_MS;
      const recent = (attempts.get(ip) ?? []).filter((t) => t > cutoff);
      recent.push(now());
      attempts.set(ip, recent);
      return recent.length > limit;
    };
  }
  const rateLimited = limiter(CONNECT_LIMIT);
  const sendLimited = limiter(SEND_LIMIT);
  const reportLimited = limiter(REPORT_LIMIT);

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
      // Not /healthz: Cloud Run's front end reserves that path for itself.
      if (pathname === '/api/health') return sendJson(res, 200, { ok: true });

      if (pathname === '/api/shared-album' && req.method === 'POST') {
        return handleSharedAlbumRequest(req, res);
      }

      // The phone's half of phone-to-TV: needs only the code from the QR.
      if (pathname === '/api/send' && req.method === 'POST' && inbox) {
        if (sendLimited(clientIp(req, trustProxy))) {
          return sendJson(res, 429, { error: 'Too many attempts. Wait a few minutes and try again.' });
        }
        let body;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
        try {
          const result = await inbox.deliver(body.code, body.url);
          if (!result.ok) {
            return sendJson(res, 404, { error: 'This code has expired. Scan the new QR code on your TV.' });
          }
          return sendJson(res, 200, { ok: true });
        } catch (err) {
          return sendJson(res, 400, {
            error: err instanceof Error && /allowed|https|valid|photo link/.test(err.message)
              ? 'That is not a Google Photos shared album link.'
              : 'Could not send that link.',
          });
        }
      }

      // The TV's half: a code to show, and an inbox to check.
      // Video troubleshooting, sent only while "Video details" is switched on
      // in Settings. Written to the request log; nothing is stored.
      if (pathname === '/api/video-report' && req.method === 'POST') {
        if (!isValidSessionSecret(req.headers['x-frame-session'])) {
          return sendJson(res, 400, { error: 'Missing or invalid X-Frame-Session header' });
        }
        if (reportLimited(clientIp(req, trustProxy))) return sendJson(res, 429, { error: 'Too many reports.' });
        let body;
        try {
          body = await readJsonBody(req, 8 * 1024);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
        console.log(JSON.stringify({ videoReport: sanitizeReport(body) }));
        return sendJson(res, 200, { ok: true });
      }

      if ((pathname === '/api/send-code' || pathname === '/api/inbox') && inbox) {
        const secret = req.headers['x-frame-session'];
        if (!isValidSessionSecret(secret)) {
          return sendJson(res, 400, { error: 'Missing or invalid X-Frame-Session header' });
        }
        const id = sessionStorageId(secret);
        if (pathname === '/api/send-code' && req.method === 'POST') return sendJson(res, 200, await inbox.issueCode(id));
        if (pathname === '/api/inbox' && req.method === 'GET') return sendJson(res, 200, await inbox.collect(id));
        return sendJson(res, 404, { error: `Unknown endpoint ${pathname}` });
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
          if (rateLimited(clientIp(req, trustProxy))) return sendJson(res, 429, { error: 'Too many pairing attempts. Try again in a few minutes.' });
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
