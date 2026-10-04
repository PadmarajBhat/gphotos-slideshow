import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  assertSharedAlbumUrl,
  extractAlbumTitle,
  extractPhotoBases,
  looksLikeAlbumHtml,
  fetchSharedAlbum,
  RELAY_FAILED_MESSAGE,
} from '../api/sharedAlbum';

const PHOTO_ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUv';

function albumHtml(ids: string[]): string {
  const images = ids
    .map((id) => `<img src="https://lh3.googleusercontent.com/pw/${id}=w200-h200">`)
    .join('');
  return [
    '<!doctype html><html><head>',
    '<meta property="og:title" content="Kerala Trip - Google Photos">',
    '</head><body>',
    images,
    '<!-- padding '.padEnd(600, 'x'),
    '--></body></html>',
  ].join('');
}

describe('Shared album URL validation', () => {
  it('accepts Google Photos share links', () => {
    expect(assertSharedAlbumUrl('https://photos.app.goo.gl/abc123').hostname).toBe('photos.app.goo.gl');
  });

  it('rejects non-Google hosts so the proxy cannot be aimed elsewhere', () => {
    expect(() => assertSharedAlbumUrl('https://evil.example.com/album')).toThrow(/Google Photos shared link/i);
  });

  it('rejects plain http and internal addresses', () => {
    expect(() => assertSharedAlbumUrl('http://photos.app.goo.gl/abc')).toThrow(/https/i);
    expect(() => assertSharedAlbumUrl('http://169.254.169.254/latest/meta-data/')).toThrow();
  });

  it('rejects text that is not a URL', () => {
    expect(() => assertSharedAlbumUrl('my holiday album')).toThrow(/valid Google Photos shared link/i);
  });
});

describe('Shared album HTML parsing', () => {
  it('recognises a real album page', () => {
    expect(looksLikeAlbumHtml(albumHtml([PHOTO_ID]))).toBe(true);
  });

  it('rejects the SPA shell a static host returns for an unknown path', () => {
    const spaShell = `<!doctype html><html><body><div id="root"></div>${'x'.repeat(600)}</body></html>`;
    expect(looksLikeAlbumHtml(spaShell)).toBe(false);
  });

  it('rejects an empty or truncated body', () => {
    expect(looksLikeAlbumHtml('')).toBe(false);
    expect(looksLikeAlbumHtml('<html></html>')).toBe(false);
  });

  it('strips the Google Photos suffix from the album title', () => {
    expect(extractAlbumTitle(albumHtml([PHOTO_ID]))).toBe('Kerala Trip');
  });

  it('drops the date range Google appends to album titles', () => {
    const html = '<meta property="og:title" content="Krishna · Sep 5, 2022 – Oct 3, 2026 📸">';
    expect(extractAlbumTitle(html)).toBe('Krishna');
  });

  it('keeps a title that merely contains a dot separator', () => {
    const html = '<meta property="og:title" content="Goa · Beach Days">';
    expect(extractAlbumTitle(html)).toBe('Goa · Beach Days');
  });

  it('falls back to a generic title when no title tag is present', () => {
    expect(extractAlbumTitle('<html><body>no title</body></html>')).toBe('Shared Google Photos Album');
  });

  it('deduplicates photo URLs and drops their size suffixes', () => {
    const bases = extractPhotoBases(albumHtml([PHOTO_ID, PHOTO_ID]));
    expect(bases).toEqual([`https://lh3.googleusercontent.com/pw/${PHOTO_ID}`]);
  });
});

describe('fetchSharedAlbum', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the public gateway when the dev proxy returns the SPA shell', async () => {
    const fetchMock = vi.mocked(fetch);
    const spaShell = `<!doctype html><html><body><div id="root"></div>${'x'.repeat(600)}</body></html>`;

    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => spaShell } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => albumHtml([PHOTO_ID]) } as unknown as Response);

    const { album, items } = await fetchSharedAlbum('https://photos.app.goo.gl/abc123');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('allorigins');
    expect(album.title).toBe('Kerala Trip');
    expect(items).toHaveLength(1);
    expect(items[0].baseUrl).toBe(`https://lh3.googleusercontent.com/pw/${PHOTO_ID}=w2560-h1440`);
  });

  it('leaves creation time blank rather than claiming the photo was taken today', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => albumHtml([PHOTO_ID]),
    } as unknown as Response);

    const { items } = await fetchSharedAlbum('https://photos.app.goo.gl/abc123');
    expect(items[0].mediaMetadata.creationTime).toBe('');
  });

  it('reports a helpful error when the album page has no photos', async () => {
    const emptyAlbum = `<html><head><title>Empty - Google Photos</title></head><body>photos.google.com${'x'.repeat(600)}</body></html>`;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => emptyAlbum,
    } as unknown as Response);

    await expect(fetchSharedAlbum('https://photos.app.goo.gl/abc123')).rejects.toThrow(/No photos were found/i);
  });

  it('explains the relay failure instead of blaming the link or the device', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error('no server')) // no /api route reachable
      .mockResolvedValueOnce({ ok: false, status: 408, text: async () => '' } as unknown as Response);

    await expect(fetchSharedAlbum('https://photos.app.goo.gl/abc123')).rejects.toThrow(RELAY_FAILED_MESSAGE);
  });

  it('treats a relay that hangs or is blocked the same way', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error('no server'))
      .mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'));

    await expect(fetchSharedAlbum('https://photos.app.goo.gl/abc123')).rejects.toThrow(RELAY_FAILED_MESSAGE);
  });

  it('prefers its own server and never touches the relay when that works', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => albumHtml([PHOTO_ID]) } as unknown as Response);

    await fetchSharedAlbum('https://photos.app.goo.gl/abc123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/fetch-shared-album');
  });

  it('never contacts the network for an invalid host', async () => {
    await expect(fetchSharedAlbum('https://evil.example.com/x')).rejects.toThrow();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
