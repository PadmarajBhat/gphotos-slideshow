/**
 * Fetches a Google Photos shared-album page server-side, so the browser never
 * depends on a public CORS relay. Public relays time out on large albums,
 * are commonly blocked by workplace networks, and see every album link.
 *
 * Used by both the Vite dev server and the production helper.
 */

/**
 * Hosts the proxy may reach. The dev server and helper bind to every
 * interface so a TV can reach them; without an allowlist they would be open
 * proxies anyone on the LAN could aim at internal HTTP endpoints.
 */
const ALLOWED_ALBUM_HOSTS = new Set([
  'photos.app.goo.gl',
  'photos.google.com',
  'goo.gl',
  'lh3.googleusercontent.com',
]);

const MAX_PROXY_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const UPSTREAM_TIMEOUT_MS = 20000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function assertAllowedTarget(rawUrl) {
  let parsed;
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
 * Letting fetch follow them automatically would let a single redirect hand an
 * attacker an arbitrary destination.
 */
export async function fetchAlbumHtml(target, { fetchImpl = fetch } = {}) {
  let current = target;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
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

/** Node http handler for GET /api/fetch-shared-album?url=... */
export async function handleSharedAlbumRequest(req, res) {
  try {
    const requestUrl = new URL(req.url || '', 'http://localhost');
    const targetUrl = requestUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Missing url query parameter' }));
      return;
    }

    const html = await fetchAlbumHtml(assertAllowedTarget(targetUrl));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Proxy fetch failed' }));
  }
}
