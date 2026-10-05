/**
 * Loads a whole Google Photos shared album server-side.
 *
 * The album page embeds only the first ~300 items; the page itself fetches
 * the rest through Google's internal batchexecute endpoint, using a
 * continuation token. This does the same, so a shared link yields every
 * photo and video, with videos playable via the "=dv" URL suffix.
 *
 * This relies on undocumented page structure. If parsing fails, it falls
 * back to scraping image URLs from the HTML (first page, photos only), so a
 * Google change degrades the frame instead of breaking it.
 */

/**
 * Hosts the helper may reach. It binds to every interface so a TV can reach
 * it; without an allowlist it would be an open proxy anyone on the LAN could
 * aim at internal HTTP endpoints.
 */
const ALLOWED_ALBUM_HOSTS = new Set([
  'photos.app.goo.gl',
  'photos.google.com',
  'goo.gl',
  'lh3.googleusercontent.com',
]);

const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const UPSTREAM_TIMEOUT_MS = 20000;
/** Stay inside Cloud Run's request timeout even for enormous albums. */
const PAGINATION_BUDGET_MS = 40000;
const MAX_PAGES = 40;
const MAX_ITEMS = 10000;
/** Key Google uses, inside an item's metadata object, for video details. */
const VIDEO_METADATA_KEY = '76647426';

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
 * Automatic following would let one redirect hand an attacker any destination.
 * Returns the page and the final URL, whose ?key= the pagination call needs.
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
    if (declaredLength > MAX_PAGE_BYTES) throw new Error('Shared album page is too large to parse');

    const html = await response.text();
    if (html.length > MAX_PAGE_BYTES) throw new Error('Shared album page is too large to parse');
    return { html, finalUrl: current };
  }

  throw new Error('Too many redirects');
}

/** Finds the page's boot data block that holds the album's media list. */
export function parseAlbumData(html) {
  for (const match of html.matchAll(/AF_initDataCallback\(\{key: 'ds:\d+'[^]*?data:(\[[^]*?\])\s*,\s*sideChannel/g)) {
    let data;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const items = data?.[1];
    const looksLikeMedia =
      Array.isArray(items) &&
      items.length > 0 &&
      typeof items[0]?.[1]?.[0] === 'string' &&
      items[0][1][0].startsWith('https://lh3.googleusercontent.com/');
    if (looksLikeMedia) {
      return {
        items,
        nextToken: typeof data[2] === 'string' ? data[2] : null,
        albumKey: typeof data[3]?.[0] === 'string' ? data[3][0] : null,
        title: typeof data[3]?.[1] === 'string' ? data[3][1] : null,
      };
    }
  }
  return null;
}

export function extractTitleFromHtml(html) {
  const match =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1] : null;
}

/** Drops the " - Google Photos" suffix and the "· Sep 5, 2022 – …" date range. */
export function cleanTitle(raw) {
  const cleaned = String(raw ?? '')
    .replace(/ - Google Photos$/i, '')
    .replace(/\s*[·•]\s*[A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}.*$/u, '')
    .trim();
  return cleaned || 'Shared Google Photos Album';
}

/** Maps one raw album entry to the slideshow's MediaItem shape. */
export function mapAlbumItem(raw, albumTitle) {
  const key = raw?.[0];
  const base = raw?.[1]?.[0];
  if (typeof key !== 'string' || typeof base !== 'string' || !base.startsWith('https://lh3.googleusercontent.com/')) {
    return null;
  }
  const timestamp = raw[2];
  const meta = raw[9] && typeof raw[9] === 'object' && !Array.isArray(raw[9]) ? raw[9] : {};
  const isVideo = Array.isArray(meta[VIDEO_METADATA_KEY]);

  return {
    id: key,
    // A video's base URL still renders a still frame, used as its poster.
    baseUrl: isVideo ? `${base}=w1920-h1080` : `${base}=w2560-h1440`,
    videoUrl: isVideo ? `${base}=dv` : undefined,
    mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
    filename: '',
    description: albumTitle,
    mediaMetadata: {
      creationTime: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '',
      width: String(raw[1][1] ?? ''),
      height: String(raw[1][2] ?? ''),
      ...(isVideo ? { video: { status: 'READY' } } : {}),
    },
  };
}

/** One page of the album beyond the first, as the album page requests it. */
async function fetchNextPage({ albumKey, authKey, token, sid, bl, fetchImpl }) {
  const fReq = JSON.stringify([[['snAcKc', JSON.stringify([albumKey, token, null, authKey]), null, 'generic']]]);
  const query = new URLSearchParams({
    rpcids: 'snAcKc',
    'source-path': `/share/${albumKey}`,
    'f.sid': sid,
    bl,
    hl: 'en',
    _reqid: String(100000 + Math.floor(Math.random() * 900000)),
    rt: 'c',
  });
  const response = await fetchImpl(`https://photos.google.com/_/PhotosUi/data/batchexecute?${query}`, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ 'f.req': fReq }).toString(),
  });
  if (!response.ok) throw new Error(`Album page request returned HTTP ${response.status}`);

  const text = await response.text();
  const line = text.split('\n').find((l) => l.includes('"wrb.fr"') && l.includes('snAcKc'));
  if (!line) throw new Error('Album page response had no data');
  const payload = JSON.parse(JSON.parse(line)[0][2]);
  return { items: Array.isArray(payload?.[1]) ? payload[1] : [], nextToken: typeof payload?.[2] === 'string' ? payload[2] : null };
}

/** Last resort if Google changes its page format: image URLs from the HTML. */
export function extractPhotoBases(html) {
  const bases = new Set();
  for (const url of html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-=]+/g) || []) {
    const base = url.split('=')[0];
    if (base.length > 50) bases.add(base);
  }
  return [...bases];
}

/**
 * Loads every item in a shared album. Returns `complete: false` when it had
 * to stop early (time budget, page cap, or the fallback path).
 */
export async function loadSharedAlbum(sharedUrl, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  const started = now();
  const { html, finalUrl } = await fetchAlbumHtml(assertAllowedTarget(sharedUrl), { fetchImpl });
  const parsed = parseAlbumData(html);
  const title = cleanTitle(parsed?.title ?? extractTitleFromHtml(html));

  if (!parsed) {
    const items = extractPhotoBases(html).map((base, i) =>
      mapAlbumItem([`shared-${i}`, [base, null, null], null], title)
    );
    if (items.length === 0) {
      throw new Error('No photos were found in this shared album. Make sure it contains photos and the link is shared.');
    }
    return { title, items, complete: false };
  }

  const raw = [...parsed.items];
  let token = parsed.nextToken;
  let complete = true;
  const sid = html.match(/"FdrFJe":"([^"]+)"/)?.[1];
  const bl = html.match(/"cfb2h":"([^"]+)"/)?.[1];
  const authKey = finalUrl.searchParams.get('key');

  if (token && !(sid && bl && authKey && parsed.albumKey)) {
    complete = false; // Can't paginate without the page's session values.
    token = null;
  }

  for (let page = 1; token; page += 1) {
    if (page >= MAX_PAGES || raw.length >= MAX_ITEMS || now() - started > PAGINATION_BUDGET_MS) {
      complete = false;
      break;
    }
    try {
      const next = await fetchNextPage({ albumKey: parsed.albumKey, authKey, token, sid, bl, fetchImpl });
      raw.push(...next.items);
      token = next.nextToken;
    } catch {
      complete = false; // Keep what we have rather than failing the album.
      break;
    }
  }

  const seen = new Set();
  const items = [];
  for (const entry of raw) {
    const item = mapAlbumItem(entry, title);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  if (items.length === 0) throw new Error('This shared album has no photos or videos to show.');
  return { title, items, complete };
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

/**
 * Node http handler for POST /api/shared-album with {"url": "..."}.
 * The link travels in the body, so it never appears in request logs.
 */
export async function handleSharedAlbumRequest(req, res) {
  const send = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
  };
  try {
    const { url } = await readJsonBody(req);
    if (typeof url !== 'string' || !url) return send(400, { error: 'Missing album link' });
    const album = await loadSharedAlbum(url);
    send(200, album);
  } catch (err) {
    send(400, { error: err instanceof Error ? err.message : 'Could not load that shared album.' });
  }
}
