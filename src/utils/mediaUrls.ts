import { MediaItem } from '../types';

export function isVideoItem(item: MediaItem): boolean {
  return Boolean(
    item.videoUrl ||
    item.mimeType?.startsWith('video/') ||
    item.mediaMetadata?.video
  );
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
