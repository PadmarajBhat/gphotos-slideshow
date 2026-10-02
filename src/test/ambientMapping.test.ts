import { describe, it, expect } from 'vitest';
import { mapMediaItem, MEDIA_REFRESH_MS, DAILY_REQUEST_BUDGET } from '../../server/ambient.mjs';
import { isVideoItem } from '../utils/mediaUrls';
import { MediaItem } from '../types';

const BASE = 'https://lh3.googleusercontent.com/ambient/AbCdEf';

/** mapMediaItem returns null for unusable input; these cases expect an item. */
function mapped(raw: unknown): MediaItem {
  const item = mapMediaItem(raw);
  if (!item) throw new Error('expected mapMediaItem to return an item');
  return item;
}

describe('AmbientMediaItem mapping', () => {
  it('maps a photo to a TV-sized URL', () => {
    const item = mapped({
      id: 'p1',
      createTime: '2025-11-14T06:45:00Z',
      mediaFile: {
        baseUrl: BASE,
        mimeType: 'image/jpeg',
        mediaFileMetadata: { width: 4032, height: 3024 },
      },
    });

    expect(item.baseUrl).toBe(`${BASE}=w2560-h1440`);
    expect(item.videoUrl).toBeUndefined();
    expect(item.mediaMetadata.creationTime).toBe('2025-11-14T06:45:00Z');
    expect(item.mediaMetadata.width).toBe('4032');
  });

  it('maps a video to the =dv streaming URL so it actually plays', () => {
    const item = mapped({
      id: 'v1',
      createTime: '2026-01-12T11:15:30Z',
      mediaFile: {
        baseUrl: BASE,
        mimeType: 'video/mp4',
        mediaFileMetadata: { width: 1920, height: 1080 },
      },
    });

    expect(item.videoUrl).toBe(`${BASE}=dv`);
    expect(item.mimeType).toBe('video/mp4');
    expect(item.mediaMetadata.video).toEqual({ status: 'READY' });
  });

  it('produces items the slideshow recognises as video', () => {
    const video = mapped({ id: 'v2', mediaFile: { baseUrl: BASE, mimeType: 'video/quicktime' } });
    const photo = mapped({ id: 'p2', mediaFile: { baseUrl: BASE, mimeType: 'image/heif' } });

    expect(isVideoItem(video)).toBe(true);
    expect(isVideoItem(photo)).toBe(false);
  });

  it('skips malformed items rather than rendering a broken slide', () => {
    expect(mapMediaItem({ id: 'x' })).toBeNull();
    expect(mapMediaItem({ id: 'y', mediaFile: {} })).toBeNull();
    expect(mapMediaItem(null)).toBeNull();
  });

  it('defaults a missing mimeType to a photo', () => {
    const item = mapped({ id: 'p3', mediaFile: { baseUrl: BASE } });
    expect(item.mimeType).toBe('image/jpeg');
    expect(isVideoItem(item)).toBe(false);
  });

  it('refreshes often enough for 60-minute baseUrls but inside the daily quota', () => {
    // A 600-item library costs 6 paged requests per full refresh.
    const refreshesPerDay = (24 * 60 * 60 * 1000) / MEDIA_REFRESH_MS;
    const requestsPerDay = refreshesPerDay * 6;

    expect(MEDIA_REFRESH_MS).toBeLessThan(60 * 60 * 1000);
    expect(requestsPerDay).toBeLessThan(DAILY_REQUEST_BUDGET);
  });
});
