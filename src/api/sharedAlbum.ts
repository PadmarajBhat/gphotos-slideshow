import { Album, MediaItem } from '../types';

const ALLOWED_HOSTS = ['photos.app.goo.gl', 'photos.google.com', 'goo.gl'];

/**
 * Public CORS gateway used only when the app is served as a static bundle and
 * the dev-server proxy is therefore unavailable. This sends the shared album
 * URL to a third party, so it is disclosed in the README and in the UI.
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
  return rawTitle.replace(/ - Google Photos$/i, '').trim() || 'Shared Google Photos Album';
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

async function loadAlbumHtml(target: URL): Promise<string> {
  const encoded = encodeURIComponent(target.toString());

  // 1. Local Vite proxy (development). Validated, because a static host
  //    answers this path with the SPA shell instead of a 404.
  try {
    const res = await fetch(`/api/fetch-shared-album?url=${encoded}`);
    if (res.ok) {
      const html = await res.text();
      if (looksLikeAlbumHtml(html)) return html;
    }
  } catch {
    // Proxy unavailable - fall through to the public gateway.
  }

  // 2. Public CORS gateway (static deployments).
  const res = await fetch(`${CORS_GATEWAY}${encoded}`);
  if (!res.ok) {
    throw new Error('Could not reach the shared album. Check the link is still shared and your TV is online.');
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
