import { describe, it, expect } from 'vitest';
import { countMedia, filterMedia, getBackdropUrl, isVideoItem, withGoogleSize } from '../utils/mediaUrls';
import { MediaItem } from '../types';

function item(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: 'x',
    baseUrl: 'https://lh3.googleusercontent.com/pw/AbCd=w2560-h1440',
    mimeType: 'image/jpeg',
    filename: 'x.jpg',
    mediaMetadata: { creationTime: '2025-01-01T00:00:00Z', width: '4', height: '3' },
    ...overrides,
  };
}

describe('withGoogleSize', () => {
  it('replaces an existing size suffix rather than appending a second one', () => {
    expect(withGoogleSize('https://lh3.googleusercontent.com/pw/AbCd=w2560-h1440', 'w480-h270')).toBe(
      'https://lh3.googleusercontent.com/pw/AbCd=w480-h270'
    );
  });

  it('appends a suffix when none is present', () => {
    expect(withGoogleSize('https://lh3.googleusercontent.com/pw/AbCd', 'w480-h270')).toBe(
      'https://lh3.googleusercontent.com/pw/AbCd=w480-h270'
    );
  });
});

describe('isVideoItem', () => {
  it('detects videos by mime type, videoUrl or video metadata', () => {
    expect(isVideoItem(item({ mimeType: 'video/mp4' }))).toBe(true);
    expect(isVideoItem(item({ videoUrl: 'https://example.com/a.mp4' }))).toBe(true);
    expect(
      isVideoItem(
        item({
          mediaMetadata: { creationTime: '', width: '1', height: '1', video: { status: 'READY' } },
        })
      )
    ).toBe(true);
  });

  it('treats plain photos as photos', () => {
    expect(isVideoItem(item({}))).toBe(false);
  });
});

describe('getBackdropUrl', () => {
  it('downsizes Google Photos images', () => {
    expect(getBackdropUrl(item({}))).toBe('https://lh3.googleusercontent.com/pw/AbCd=w480-h270');
  });

  it('downsizes images that carry a width query parameter', () => {
    expect(getBackdropUrl(item({ baseUrl: 'https://images.unsplash.com/photo-1?w=1920&q=85' }))).toBe(
      'https://images.unsplash.com/photo-1?w=480&q=85'
    );
  });

  it('leaves URLs it does not understand untouched', () => {
    expect(getBackdropUrl(item({ baseUrl: 'https://example.com/plain.jpg' }))).toBe(
      'https://example.com/plain.jpg'
    );
  });

  it('returns null for videos, which have no still frame to blur', () => {
    expect(getBackdropUrl(item({ mimeType: 'video/mp4' }))).toBeNull();
  });
});

describe('countMedia and filterMedia', () => {
  const photo = item({ id: 'p' });
  const clip = item({ id: 'v', mimeType: 'video/mp4', videoUrl: 'https://lh3.googleusercontent.com/pw/v=dv' });
  const album = [photo, clip, item({ id: 'p2' })];

  it('counts photos and videos', () => {
    expect(countMedia(album)).toEqual({ photos: 2, videos: 1 });
  });

  it('plays only the chosen kind', () => {
    expect(filterMedia(album, 'videos').map((i) => i.id)).toEqual(['v']);
    expect(filterMedia(album, 'photos').map((i) => i.id)).toEqual(['p', 'p2']);
    expect(filterMedia(album, 'all')).toBe(album);
  });

  it('plays everything rather than nothing when an album has none of that kind', () => {
    const photosOnly = [photo];
    expect(filterMedia(photosOnly, 'videos')).toBe(photosOnly);
  });
});
