// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createServer } from 'node:http';
import {
  assertAllowedTarget,
  cleanTitle,
  fetchAlbumHtml,
  handleSharedAlbumRequest,
  loadSharedAlbum,
  mapAlbumItem,
  parseAlbumData,
} from '../sharedAlbum.mjs';

const LH3 = 'https://lh3.googleusercontent.com/pw/';
const photo = (key, t = 1662388343000) => [key, [`${LH3}${key}${'x'.repeat(60)}`, 4032, 3024], t, 'k', 0, 0, [1], [], 0, {}];
const video = (key) => [key, [`${LH3}${key}${'v'.repeat(60)}`, 480, 864], 1662388344000, 'k', 0, 0, [1], [], 0, { 76647426: [47899, null, 480, 864] }];

function albumPage({ items, nextToken = null, title = 'Krishna · Sep 5, 2022 – Oct 3, 2026 📸', wiz = true }) {
  const data = JSON.stringify([null, items, nextToken, ['ALBUMKEY', title], null, 1]);
  return [
    '<html><head><title>Krishna - Google Photos</title></head><body>',
    `<script>AF_initDataCallback({key: 'ds:1', hash: '2', data:${data}, sideChannel: {}});</script>`,
    wiz ? '<script>window.WIZ_global_data = {"FdrFJe":"-1234","cfb2h":"boq_photos_20260101"};</script>' : '',
    '</body></html>',
  ].join('');
}

const batchResponse = (items, nextToken = null) =>
  `)]}'\n\n123\n${JSON.stringify([['wrb.fr', 'snAcKc', JSON.stringify([null, items, nextToken]), null, null, null, 'generic']])}\n`;

/** A fake Google: short link → album page → further pages. */
function fakeGoogle({ html, pages = [], failPaging = false }) {
  const calls = [];
  const fetchImpl = vi.fn(async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('https://photos.app.goo.gl/')) {
      return new Response(null, { status: 302, headers: { location: 'https://photos.google.com/share/ALBUMKEY?key=AUTHKEY' } });
    }
    if (url.startsWith('https://photos.google.com/share/')) return new Response(html, { status: 200 });
    if (url.startsWith('https://photos.google.com/_/PhotosUi/data/batchexecute')) {
      if (failPaging) return new Response('nope', { status: 500 });
      const next = pages.shift();
      return new Response(batchResponse(next.items, next.nextToken ?? null), { status: 200 });
    }
    throw new Error(`unexpected ${url}`);
  });
  return { fetchImpl, calls };
}

describe('Whole shared album loading', () => {
  it('follows the continuation token to fetch every page, not just the first 300', async () => {
    const { fetchImpl, calls } = fakeGoogle({
      html: albumPage({ items: [photo('A'), video('B')], nextToken: 'TOKEN-1' }),
      pages: [{ items: [photo('C')], nextToken: 'TOKEN-2' }, { items: [photo('D')] }],
    });

    const album = await loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl });

    expect(album.items.map((i) => i.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(album.complete).toBe(true);
    expect(album.title).toBe('Krishna');

    // The page request carries the album key, its token, and the share key.
    const pageCall = calls.find((c) => c.url.includes('batchexecute'));
    const fReq = new URLSearchParams(pageCall.init.body).get('f.req');
    expect(fReq).toContain('ALBUMKEY');
    expect(fReq).toContain('TOKEN-1');
    expect(fReq).toContain('AUTHKEY');
    expect(pageCall.url).toContain('f.sid=-1234');
  });

  it('marks videos so they play in full, via the =dv stream', async () => {
    const { fetchImpl } = fakeGoogle({ html: albumPage({ items: [photo('A'), video('B')] }) });

    const { items } = await loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl });

    expect(items[0]).toMatchObject({ mimeType: 'image/jpeg', videoUrl: undefined });
    expect(items[0].baseUrl).toMatch(/=w2560-h1440$/);
    expect(items[1]).toMatchObject({ mimeType: 'video/mp4' });
    expect(items[1].videoUrl).toMatch(/=dv$/);
    expect(items[1].mediaMetadata.video).toEqual({ status: 'READY' });
  });

  it('keeps the capture time Google provides', async () => {
    const { fetchImpl } = fakeGoogle({ html: albumPage({ items: [photo('A', 1662388343000)] }) });
    const { items } = await loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl });
    expect(items[0].mediaMetadata.creationTime).toBe('2022-09-05T14:32:23.000Z');
  });

  it('keeps the first page if a later page fails, and says so', async () => {
    const { fetchImpl } = fakeGoogle({ html: albumPage({ items: [photo('A')], nextToken: 'T' }), failPaging: true });
    const album = await loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl });
    expect(album.items).toHaveLength(1);
    expect(album.complete).toBe(false);
  });

  it("doesn't page when the album page lacks the values paging needs", async () => {
    const { fetchImpl, calls } = fakeGoogle({ html: albumPage({ items: [photo('A')], nextToken: 'T', wiz: false }) });
    const album = await loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl });
    expect(album.complete).toBe(false);
    expect(calls.some((c) => c.url.includes('batchexecute'))).toBe(false);
  });

  it('falls back to scraping photos if Google changes the page format', async () => {
    const html = `<html><head><title>Trip - Google Photos</title></head><body><img src="${LH3}${'Z'.repeat(70)}=w200"></body></html>`;
    const { fetchImpl } = fakeGoogle({ html });
    const album = await loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl });
    expect(album.items).toHaveLength(1);
    expect(album.complete).toBe(false);
    expect(album.title).toBe('Trip');
  });

  it('reports an album with nothing in it', async () => {
    const { fetchImpl } = fakeGoogle({ html: '<html><title>Empty - Google Photos</title></html>' });
    await expect(loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl })).rejects.toThrow(/No photos/);
  });

  it('drops duplicate items across pages', async () => {
    const { fetchImpl } = fakeGoogle({
      html: albumPage({ items: [photo('A')], nextToken: 'T' }),
      pages: [{ items: [photo('A'), photo('B')] }],
    });
    const { items } = await loadSharedAlbum('https://photos.app.goo.gl/abc', { fetchImpl });
    expect(items.map((i) => i.id)).toEqual(['A', 'B']);
  });
});

describe('Parsing helpers', () => {
  it('cleans Google’s title suffixes', () => {
    expect(cleanTitle('Krishna · Sep 5, 2022 – Oct 3, 2026 📸')).toBe('Krishna');
    expect(cleanTitle('Goa · Beach Days')).toBe('Goa · Beach Days');
    expect(cleanTitle('Trip - Google Photos')).toBe('Trip');
    expect(cleanTitle('')).toBe('Shared Google Photos Album');
  });

  it('ignores data blocks that are not a media list', () => {
    expect(parseAlbumData("AF_initDataCallback({key: 'ds:0', data:[1,2,3], sideChannel: {}});")).toBeNull();
  });

  it('skips malformed items', () => {
    expect(mapAlbumItem(['k', ['https://evil.example/x', 1, 1]], 'T')).toBeNull();
    expect(mapAlbumItem(null, 'T')).toBeNull();
  });
});

describe('Link safety', () => {
  it('accepts only Google Photos hosts over https', () => {
    expect(assertAllowedTarget('https://photos.app.goo.gl/abc').hostname).toBe('photos.app.goo.gl');
    expect(() => assertAllowedTarget('http://169.254.169.254/latest/meta-data/')).toThrow(/https/);
    expect(() => assertAllowedTarget('https://example.com/')).toThrow(/not an allowed/);
  });

  it('refuses to follow a redirect to another host', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://evil.example.com/steal' } })
    );
    await expect(fetchAlbumHtml(new URL('https://photos.app.goo.gl/abc'), { fetchImpl })).rejects.toThrow(/not an allowed/);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('gives up after too many redirects', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () =>
      new Response(null, { status: 302, headers: { location: 'https://photos.google.com/loop' } })
    );
    await expect(fetchAlbumHtml(new URL('https://photos.google.com/start'), { fetchImpl })).rejects.toThrow(/Too many redirects/);
  });
});

describe('POST /api/shared-album', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function post(body) {
    const server = createServer(handleSharedAlbumRequest);
    await new Promise((r) => server.listen(0, r));
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return { status: res.status, json: await res.json() };
    } finally {
      await new Promise((r) => server.close(r));
    }
  }

  it('takes the link from the body, keeping it out of request logs', async () => {
    const realFetch = globalThis.fetch;
    const { fetchImpl } = fakeGoogle({ html: albumPage({ items: [photo('A')] }) });
    // Only Google's URLs go to the fake; the test's own request uses the real fetch.
    vi.stubGlobal('fetch', (input, init) =>
      String(input).startsWith('http://127.0.0.1') ? realFetch(input, init) : fetchImpl(input, init)
    );

    const { status, json } = await post(JSON.stringify({ url: 'https://photos.app.goo.gl/abc' }));

    expect(status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.title).toBe('Krishna');
  });

  it('rejects a missing link or a non-Google one', async () => {
    expect((await post('{}')).status).toBe(400);
    expect((await post(JSON.stringify({ url: 'https://example.com/x' }))).json.error).toMatch(/not an allowed/);
  });

  it('rejects a body that is not JSON', async () => {
    expect((await post('not json')).status).toBe(400);
  });
});
