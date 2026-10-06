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
export function videoSources(item: MediaItem, box?: VideoBox): string[] {
  const url = item.videoUrl || item.baseUrl;
  if (!/^https:\/\/lh3\.googleusercontent\.com\/.*=dv$/.test(url)) return [url];
  const base = url.slice(0, -'=dv'.length);
  const renditions = RENDITIONS.map(([suffix, shortSide]) => ({ url: `${base}=${suffix}`, shortSide }));

  const w = Number(item.mediaMetadata?.width);
  const h = Number(item.mediaMetadata?.height);
  if (!box || !(w > 0 && h > 0)) return [...renditions.map((r) => r.url), url];

  // A rendition's short side is its nominal size and its long side follows
  // the video's shape, which the album reports reliably even where it
  // understates the size. Those that fit come first, largest first; the
  // rest follow, smallest first, each still checked against its real size
  // as it loads.
  const fits = (shortSide: number) => {
    const longSide = (shortSide * Math.max(w, h)) / Math.min(w, h);
    const [vw, vh] = w >= h ? [longSide, shortSide] : [shortSide, longSide];
    return vw <= box.width && vh <= box.height;
  };
  const fitting = renditions.filter((r) => fits(r.shortSide));
  const tooBig = renditions.filter((r) => !fits(r.shortSide)).reverse();
  return [...fitting, ...tooBig].map((r) => r.url).concat(url);
}

/** The largest picture a decoder can take, in landscape terms. */
export interface VideoBox {
  width: number;
  height: number;
}

/**
 * What older TVs' hardware decoders are built for. A 2015 Bravia given a
 * 1080x1920 portrait stream played its sound with no picture, and could not
 * show the next several videos either, so TVs keep within this.
 */
export const TV_VIDEO_BOX: VideoBox = { width: 1920, height: 1088 };

/** Google's streaming renditions and their nominal short side. */
const RENDITIONS = [
  ['m37', 1080],
  ['m22', 720],
  ['m18', 360],
] as const;

/** Whether a video, as actually delivered, is bigger than the box allows. */
export function exceedsBox(videoWidth: number, videoHeight: number, box: VideoBox): boolean {
  return videoWidth > box.width || videoHeight > box.height;
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
