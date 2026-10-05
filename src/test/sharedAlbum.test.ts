import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertSharedAlbumUrl, fetchSharedAlbum } from '../api/sharedAlbum';

const photoItem = {
  id: 'A',
  baseUrl: 'https://lh3.googleusercontent.com/pw/AAA=w2560-h1440',
  mimeType: 'image/jpeg',
  filename: '',
  mediaMetadata: { creationTime: '2022-09-05T14:32:23.000Z', width: '4032', height: '3024' },
};
const videoItem = {
  ...photoItem,
  id: 'B',
  baseUrl: 'https://lh3.googleusercontent.com/pw/BBB=w1920-h1080',
  videoUrl: 'https://lh3.googleusercontent.com/pw/BBB=dv',
  mimeType: 'video/mp4',
};

const reply = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as unknown as Response;

describe('Shared album URL validation', () => {
  it('accepts Google Photos share links', () => {
    expect(assertSharedAlbumUrl('https://photos.app.goo.gl/abc123').hostname).toBe('photos.app.goo.gl');
  });

  it('rejects non-Google hosts', () => {
    expect(() => assertSharedAlbumUrl('https://evil.example.com/album')).toThrow(/Google Photos shared link/i);
  });

  it('rejects plain http and text that is not a URL', () => {
    expect(() => assertSharedAlbumUrl('http://photos.app.goo.gl/abc')).toThrow(/https/i);
    expect(() => assertSharedAlbumUrl('my holiday album')).toThrow(/valid Google Photos shared link/i);
  });
});

describe('fetchSharedAlbum', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('asks the helper for the whole album, with the link in the body rather than the URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ title: 'Krishna', items: [videoItem, photoItem], complete: true }));

    await fetchSharedAlbum('https://photos.app.goo.gl/abc123');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/shared-album$/);
    expect(url).not.toContain('goo.gl');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://photos.app.goo.gl/abc123' });
  });

  it('never contacts a third-party relay', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ error: 'boom' }, false, 400));
    await expect(fetchSharedAlbum('https://photos.app.goo.gl/abc')).rejects.toThrow('boom');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain('allorigins');
  });

  it('returns photos and videos, with a photo as the cover', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ title: 'Krishna', items: [videoItem, photoItem], complete: true }));

    const { album, items, complete } = await fetchSharedAlbum('https://photos.app.goo.gl/abc123');

    expect(items).toHaveLength(2);
    expect(items[0].videoUrl).toMatch(/=dv$/);
    expect(album.title).toBe('Krishna');
    expect(album.mediaItemsCount).toBe('2');
    expect(album.coverPhotoBaseUrl).toBe('https://lh3.googleusercontent.com/pw/AAA=w800-h800-c');
    expect(complete).toBe(true);
  });

  it('passes on the helper’s explanation when an album fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply({ error: 'No photos were found in this shared album.' }, false, 400));
    await expect(fetchSharedAlbum('https://photos.app.goo.gl/abc')).rejects.toThrow(/No photos were found/);
  });

  it('explains when the helper cannot be reached', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(fetchSharedAlbum('https://photos.app.goo.gl/abc')).rejects.toThrow(/photo service/);
  });

  it('never contacts the network for an invalid link', async () => {
    await expect(fetchSharedAlbum('https://evil.example.com/x')).rejects.toThrow();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
