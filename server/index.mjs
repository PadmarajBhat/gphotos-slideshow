import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { config, projectRoot } from './env.mjs';
import { createAmbientState } from './state.mjs';
import { handleSharedAlbumRequest } from './sharedAlbumProxy.mjs';

const distDir = resolve(projectRoot, 'dist');

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
  '.woff2': 'font/woff2',
};

const ambient = createAmbientState();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function serveStatic(req, res, pathname) {
  // Reject traversal before touching the filesystem.
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // Unknown path: fall back to the SPA entry point.
    filePath = join(distDir, 'index.html');
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(
      'LuminaFrame is not built yet. Run "npm run build" first, or use "npm run dev" for development.'
    );
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const { pathname } = url;

  // The browser talks to this helper from the Vite dev origin during development.
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  try {
    if (pathname === '/api/ambient/status' && req.method === 'GET') {
      return sendJson(res, 200, ambient.snapshot());
    }

    if (pathname === '/api/ambient/connect' && req.method === 'POST') {
      return sendJson(res, 200, await ambient.beginPairing());
    }

    if (pathname === '/api/ambient/disconnect' && req.method === 'POST') {
      return sendJson(res, 200, await ambient.disconnect());
    }

    if (pathname === '/api/ambient/media' && req.method === 'GET') {
      const snapshot = ambient.snapshot();
      return sendJson(res, 200, {
        items: ambient.getMedia(),
        lastRefreshedAt: snapshot.lastRefreshedAt,
        phase: snapshot.phase,
      });
    }

    // Shared-album pages are fetched here, server-side, so a home install
    // never depends on a public CORS relay.
    if (pathname === '/api/fetch-shared-album' && req.method === 'GET') {
      return handleSharedAlbumRequest(req, res);
    }

    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: `Unknown endpoint ${pathname}` });
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[helper]', err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(config.port, () => {
  const snapshot = ambient.snapshot();
  console.log(`\n  LuminaFrame helper listening on http://localhost:${config.port}`);
  console.log(`  Serving built app from ${distDir}`);

  if (snapshot.phase === 'unconfigured') {
    console.log(`\n  ⚠  ${snapshot.message}\n`);
  } else {
    console.log('  Google Photos Ambient API ready. Open the app to pair this frame.\n');
  }
  ambient.resume();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    ambient.stop();
    server.close(() => process.exit(0));
  });
}
