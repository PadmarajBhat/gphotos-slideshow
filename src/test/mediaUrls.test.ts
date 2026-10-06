import { describe, it, expect } from 'vitest';
import { TV_VIDEO_BOX, countMedia, exceedsBox, filterMedia, getBackdropUrl, isVideoItem, videoSources, withGoogleSize } from '../utils/mediaUrls';
import { TV_BROWSER_PATTERN } from '../utils/device';
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

describe('videoSources', () => {
  const clip = (width: string, height: string) =>
    item({ id: 'v', mimeType: 'video/mp4', videoUrl: 'https://lh3.googleusercontent.com/pw/v=dv', mediaMetadata: { creationTime: '', width, height } });
  const suffixes = (urls: string[]) => urls.map((u) => u.split('=').pop());

  it('plays the best stream first on phones and computers', () => {
    expect(suffixes(videoSources(clip('604', '1072')))).toEqual(['m37', 'm22', 'm18', 'dv']);
  });

  // Regression: a 2015 Bravia showed no picture for portrait 1080p and 720p
  // streams, and then for the next several videos as well.
  it('on a TV, puts the streams that fit a 1920x1080 decoder first', () => {
    // Portrait 9:16: only the 360p stream (360x640) fits; the album
    // understates this one's size, but its shape is right.
    expect(suffixes(videoSources(clip('604', '1072'), TV_VIDEO_BOX))).toEqual(['m18', 'm22', 'm37', 'dv']);
    // Landscape 16:9 fits at full 1080p.
    expect(suffixes(videoSources(clip('1920', '1080'), TV_VIDEO_BOX))).toEqual(['m37', 'm22', 'm18', 'dv']);
    // Square fits at 1080x1080.
    expect(suffixes(videoSources(clip('352', '352'), TV_VIDEO_BOX))[0]).toBe('m37');
  });

  it('checks the real size: portrait 720p is too tall for a TV, landscape 1080p is not', () => {
    expect(exceedsBox(720, 1280, TV_VIDEO_BOX)).toBe(true);
    expect(exceedsBox(1080, 1920, TV_VIDEO_BOX)).toBe(true);
    expect(exceedsBox(1920, 1080, TV_VIDEO_BOX)).toBe(false);
    expect(exceedsBox(360, 640, TV_VIDEO_BOX)).toBe(false);
  });

  it('recognises TV browsers, including the Bravia’s Vewd browser', () => {
    expect(TV_BROWSER_PATTERN.test('Mozilla/5.0 (Linux; Andr0id 8.0.0; BRAVIA 2015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.120 Safari/537.36 OMI/4.25.1.92.StableAVB_Sony.1')).toBe(true);
    expect(TV_BROWSER_PATTERN.test('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36')).toBe(false);
    expect(TV_BROWSER_PATTERN.test('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36')).toBe(false);
  });
});
