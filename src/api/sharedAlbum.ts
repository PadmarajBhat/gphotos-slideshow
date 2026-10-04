import { Album, MediaItem } from '../types';
import { IS_STATIC_HOSTING } from './ambient';

const ALLOWED_HOSTS = ['photos.app.goo.gl', 'photos.google.com', 'goo.gl'];

/**
 * Public CORS relay, used only when no server of our own is reachable (the
 * GitHub Pages build). It sees the album URL and is unreliable on large
 * albums, so it is a last resort, disclosed in the README.
 */
const CORS_GATEWAY = 'https://api.allorigins.win/raw?url=';

export function assertSharedAlbumUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Please enter a valid Google Photos shared link, for example https://photos.app.goo.gl/...');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Shared album links must start with https://');
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    throw new Error('That does not look like a Google Photos shared link. Expected a photos.app.goo.gl or photos.google.com URL.');
  }

  return parsed;
}

/**
 * The dev proxy only exists while Vite is running. On a static host the same
 * path hits the SPA fallback and returns index.html with HTTP 200, so a
 * non-empty body is not proof that the fetch worked - the body has to actually
 * look like a Google Photos page.
 */
export function looksLikeAlbumHtml(html: string): boolean {
  if (!html || html.length < 512) return false;
  if (html.includes('<div id="root"></div>')) return false;
  return /lh3\.googleusercontent\.com/.test(html) || /photos\.google\.com/.test(html);
}

export function extractAlbumTitle(html: string): string {
  const titleMatch =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1] : 'Shared Google Photos Album';
  const cleaned = rawTitle
    .replace(/ - Google Photos$/i, '')
    // Google appends " · Sep 5, 2022 – Oct 3, 2026 📸" to album titles; the
    // range is noise on a caption, and is repeated on every photo.
    .replace(/\s*[·•]\s*[A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}.*$/u, '')
    .trim();
  return cleaned || 'Shared Google Photos Album';
}

export function extractPhotoBases(html: string): string[] {
  const uniqueBases = new Set<string>();

  const matches = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-=]+/g) || [];
  for (const url of matches) {
    const cleanBase = url.split('=')[0];
    if (cleanBase.length > 50) {
      uniqueBases.add(cleanBase);
    }
  }

  // Fallback to general lh3 matching if no pw/ items
  if (uniqueBases.size === 0) {
    const genericMatches = html.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9_\-=]+/g) || [];
    for (const url of genericMatches) {
      const cleanBase = url.split('=')[0];
      if (cleanBase.length > 60) {
        uniqueBases.add(cleanBase);
      }
    }
  }

  return Array.from(uniqueBases);
}

/** Free relays can hang far longer than anyone will watch a spinner. */
const RELAY_TIMEOUT_MS = 25000;

export const RELAY_FAILED_MESSAGE =
  "This public site couldn't load that album. It has to read albums through a free public relay, " +
  'which often times out on large albums and is blocked on many workplace networks. ' +
  'Shared links work reliably in the home version of LuminaFrame, which fetches albums directly from Google.';

async function loadAlbumHtml(target: URL): Promise<string> {
  const encoded = encodeURIComponent(target.toString());

  // 1. Our own server: the dev server or the home helper fetches Google
  //    directly. Validated, because a static host may answer this path with
  //    the SPA shell. Skipped on GitHub Pages, where no server exists.
  if (!IS_STATIC_HOSTING) {
    try {
      const res = await fetch(`/api/fetch-shared-album?url=${encoded}`);
      if (res.ok) {
        const html = await res.text();
        if (looksLikeAlbumHtml(html)) return html;
      }
    } catch {
      // No server reachable - fall through to the public relay.
    }
  }

  // 2. Public relay: the only option for a purely static deployment.
  let res: Response;
  try {
    res = await fetch(`${CORS_GATEWAY}${encoded}`, {
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
  } catch {
    throw new Error(RELAY_FAILED_MESSAGE);
  }
  if (!res.ok) {
    throw new Error(RELAY_FAILED_MESSAGE);
  }

  const html = await res.text();
  if (!looksLikeAlbumHtml(html)) {
    throw new Error('Could not read that shared album page. Make sure the link is set to "Anyone with the link".');
  }
  return html;
}

export async function fetchSharedAlbum(sharedUrl: string): Promise<{
  album: Album;
  items: MediaItem[];
}> {
  const target = assertSharedAlbumUrl(sharedUrl);
  const html = await loadAlbumHtml(target);

  const albumTitle = extractAlbumTitle(html);
  const bases = extractPhotoBases(html);

  if (bases.length === 0) {
    throw new Error('No photos were found in this shared album. Make sure it contains photos and the link is public.');
  }

  const album: Album = {
    id: `shared-${Date.now()}`,
    title: albumTitle,
    coverPhotoBaseUrl: `${bases[0]}=w800-h800-c`,
    mediaItemsCount: bases.length.toString(),
    isDemo: false,
  };

  const items: MediaItem[] = bases.map((base, idx) => ({
    id: `shared-item-${idx}`,
    baseUrl: `${base}=w2560-h1440`,
    mimeType: 'image/jpeg',
    filename: `photo_${idx + 1}.jpg`,
    mediaMetadata: {
      creationTime: '',
      width: '1920',
      height: '1080',
    },
    description: `${albumTitle} - Photo ${idx + 1}`,
  }));

  return { album, items };
}
