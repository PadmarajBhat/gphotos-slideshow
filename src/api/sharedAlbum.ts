import { Album, MediaItem } from '../types';
import { HAS_HELPER, HELPER_URL } from './ambient';

const ALLOWED_HOSTS = ['photos.app.goo.gl', 'photos.google.com', 'goo.gl'];

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

interface SharedAlbumResponse {
  title: string;
  items: MediaItem[];
  complete: boolean;
}

export const NO_HELPER_MESSAGE = 'Shared albums need the photo service, which is unavailable right now.';

/**
 * Asks the photo helper (home, dev server or Cloud Run) to load the whole
 * album from Google, photos and videos included. The link travels in the
 * request body so it never lands in server request logs, and no third-party
 * relay ever sees it.
 */
export async function fetchSharedAlbum(sharedUrl: string): Promise<{
  album: Album;
  items: MediaItem[];
  complete: boolean;
}> {
  const target = assertSharedAlbumUrl(sharedUrl);
  if (!HAS_HELPER) throw new Error(NO_HELPER_MESSAGE);

  let res: Response;
  try {
    res = await fetch(`${HELPER_URL}/api/shared-album`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: target.toString() }),
    });
  } catch {
    throw new Error(NO_HELPER_MESSAGE);
  }

  let data: Partial<SharedAlbumResponse> & { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error('Could not read the album. Try again in a moment.');
  }
  if (!res.ok) throw new Error(data.error ?? 'Could not load that shared album.');

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) throw new Error('This shared album has no photos or videos to show.');

  const firstPhoto = items.find((item) => !item.videoUrl) ?? items[0];
  const album: Album = {
    id: `shared-${target.pathname}`,
    title: data.title || 'Shared Google Photos Album',
    // Swap the display size suffix for a square thumbnail.
    coverPhotoBaseUrl: firstPhoto.baseUrl.replace(/=[^/=]*$/, '=w800-h800-c'),
    mediaItemsCount: String(items.length),
    isDemo: false,
  };

  return { album, items, complete: data.complete !== false };
}
