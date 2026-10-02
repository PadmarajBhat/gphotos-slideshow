/// <reference types="vitest" />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Hosts the shared-album proxy is allowed to reach. Without an allowlist the
 * dev server - which binds to every interface - becomes an open proxy that
 * anyone on the LAN can use to read internal HTTP endpoints.
 */
const ALLOWED_ALBUM_HOSTS = new Set([
  'photos.app.goo.gl',
  'photos.google.com',
  'goo.gl',
  'lh3.googleusercontent.com',
]);

const MAX_PROXY_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function assertAllowedTarget(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Target is not a valid absolute URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only https targets are allowed');
  }
  if (!ALLOWED_ALBUM_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host "${parsed.hostname}" is not an allowed Google Photos host`);
  }
  return parsed;
}

/**
 * Follow redirects manually so every hop is re-checked against the allowlist.
 * Letting fetch follow them automatically would let a single Google redirect
 * hand an attacker an arbitrary destination.
 */
async function fetchAlbumHtml(target: URL): Promise<string> {
  let current = target;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without a location header');
      current = assertAllowedTarget(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Google Photos returned HTTP ${response.status}`);
    }

    const declaredLength = Number(response.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_PROXY_BYTES) {
      throw new Error('Shared album page is too large to parse');
    }

    const html = await response.text();
    if (html.length > MAX_PROXY_BYTES) {
      throw new Error('Shared album page is too large to parse');
    }
    return html;
  }

  throw new Error('Too many redirects');
}

function sharedAlbumProxyPlugin(): Plugin {
  return {
    name: 'shared-album-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fetch-shared-album', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const targetUrl = urlObj.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing url query parameter' }));
            return;
          }

          const target = assertAllowedTarget(targetUrl);
          const html = await fetchAlbumHtml(target);

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err: unknown) {
          res.statusCode = 400;
          const msg = err instanceof Error ? err.message : 'Proxy fetch failed';
          res.end(JSON.stringify({ error: msg }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), sharedAlbumProxyPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // The Ambient helper holds the Google client secret, which a browser
      // cannot. It runs as a separate local process (npm run helper).
      '/api/ambient': {
        target: `http://localhost:${process.env.HELPER_PORT ?? 4000}`,
        changeOrigin: false,
      },
    },
  },
});
