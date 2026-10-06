import { MediaFilter, MediaItem } from '../types';

export function isVideoItem(item: MediaItem): boolean {
  return Boolean(
    item.videoUrl ||
    item.mimeType?.startsWith('video/') ||
    item.mediaMetadata?.video
  );
}

/**
 * Where to fetch a video from, best first. For Google videos these are the
 * streams Google Photos itself plays: 1080p, 720p and 360p H.264 from Google's
 * video network, correctly labelled for hardware decoders and seekable. The
 * original file (=dv) comes last: it is often labelled with an H.264 level
 * too low for its resolution, which phones shrug off but TV decoders stall
 * on, and it can't be fetched in parts. Small videos lack the larger streams;
 * a missing one fails at once and the next is tried.
 */
export function videoSources(item: MediaItem): string[] {
  const url = item.videoUrl || item.baseUrl;
  if (/^https:\/\/lh3\.googleusercontent\.com\/.*=dv$/.test(url)) {
    const base = url.slice(0, -'=dv'.length);
    return [`${base}=m37`, `${base}=m22`, `${base}=m18`, url];
  }
  return [url];
}

/** How many photos and how many videos an album holds. */
export function countMedia(items: MediaItem[]): { photos: number; videos: number } {
  const videos = items.filter(isVideoItem).length;
  return { photos: items.length - videos, videos };
}

/**
 * The items to play for the chosen filter. An album with none of the chosen
 * kind plays everything, rather than showing nothing.
 */
export function filterMedia(items: MediaItem[], filter: MediaFilter): MediaItem[] {
  if (filter === 'all') return items;
  const wanted = items.filter((item) => isVideoItem(item) === (filter === 'videos'));
  return wanted.length > 0 ? wanted : items;
}

/**
 * Google media URLs carry their size as a `=w1920-h1080` style suffix. Replace
 * whatever suffix is present rather than appending a second one.
 */
export function withGoogleSize(baseUrl: string, spec: string): string {
  const lastEquals = baseUrl.lastIndexOf('=');
  const hasSizeSuffix = lastEquals > baseUrl.lastIndexOf('/');
  const root = hasSizeSuffix ? baseUrl.slice(0, lastEquals) : baseUrl;
  return `${root}=${spec}`;
}

/**
 * The backdrop is blurred beyond recognition, so it only ever needs a tiny
 * image. Decoding the full 2560px original a second time is what makes the
 * slideshow stutter on TV-class hardware.
 */
export function getBackdropUrl(item: MediaItem): string | null {
  if (isVideoItem(item)) return null;

  const url = item.baseUrl;
  if (!url) return null;

  if (url.includes('googleusercontent.com')) {
    return withGoogleSize(url, 'w480-h270');
  }

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('w')) {
      parsed.searchParams.set('w', '480');
      parsed.searchParams.delete('h');
      return parsed.toString();
    }
  } catch {
    // Relative or malformed URL - fall through and use it unchanged.
  }

  return url;
}

/** Warm the browser cache for the next photo so transitions do not show a gap. */
export function preloadImage(url: string | undefined): void {
  if (!url || typeof Image === 'undefined') return;
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}
