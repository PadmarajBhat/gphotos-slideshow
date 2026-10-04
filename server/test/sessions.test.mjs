// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const AMBIENT = 'https://photosambient.googleapis.com/v1';
const REFRESH_TOKEN = '1//very-secret-refresh-token';

function memoryStore() {
  const sessions = new Map();
  const media = new Map();
  return {
    sessions,
    media,
    getSession: async (id) => structuredClone(sessions.get(id) ?? null),
    putSession: async (id, v) => void sessions.set(id, structuredClone(v)),
    deleteSession: async (id) => void sessions.delete(id),
    getMedia: async (id) => structuredClone(media.get(id) ?? null),
    putMedia: async (id, v) => void media.set(id, structuredClone(v)),
    deleteMedia: async (id) => void media.delete(id),
  };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fake Google: device flow, token refresh, and the Ambient API. */
function fakeGoogle() {
  const g = { tokenReply: 'pending', sourcesSet: false, items: 150, refreshFails: false, calls: [] };
  g.fetch = vi.fn(async (input, init = {}) => {
    const url = String(input);
    const body = new URLSearchParams(init.body ?? '');
    g.calls.push(url.replace(/\?.*/, ''));

    if (url === 'https://oauth2.googleapis.com/device/code') {
      return json({ device_code: 'dev-code', user_code: 'HXFZ-JKTQ', verification_url: 'https://www.google.com/device', expires_in: 1800, interval: 5 });
    }
    if (url === 'https://oauth2.googleapis.com/token' && body.get('grant_type') === 'refresh_token') {
      return g.refreshFails ? json({ error: 'invalid_grant' }, 400) : json({ access_token: 'access-2', expires_in: 3600 });
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      return g.tokenReply === 'granted'
        ? json({ access_token: 'access-1', refresh_token: REFRESH_TOKEN, expires_in: 3600 })
        : json({ error: 'authorization_pending' }, 428);
    }
    if (url === 'https://oauth2.googleapis.com/revoke') return json({});
    if (url === `${AMBIENT}/devices` && init.method === 'POST') {
      return json({ id: 'device-1', settingsUri: 'https://photos.google.com/frame/1', mediaSourcesSet: g.sourcesSet });
    }
    if (url.startsWith(`${AMBIENT}/devices/`)) {
      return json({ id: 'device-1', settingsUri: 'https://photos.google.com/frame/1', mediaSourcesSet: g.sourcesSet });
    }
    if (url.startsWith(`${AMBIENT}/mediaItems`)) {
      const page = new URL(url).searchParams.get('pageToken') ? 2 : 1;
      const count = page === 1 ? Math.min(100, g.items) : g.items - 100;
      const items = Array.from({ length: count }, (_, i) => ({
        id: `m${page}-${i}`,
        createTime: '2025-01-01T00:00:00Z',
        mediaFile: { baseUrl: `https://lh3.googleusercontent.com/x${page}${i}`, mimeType: i === 0 ? 'video/mp4' : 'image/jpeg' },
      }));
      return json(page === 1 && g.items > 100 ? { mediaItems: items, nextPageToken: 'p2' } : { mediaItems: items });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  return g;
}

describe('Per-TV pairing on a server that sleeps between requests', () => {
  let google, store, clock, service;
  const TV_A = 'a'.repeat(64);
  const TV_B = 'b'.repeat(64);

  beforeEach(async () => {
    vi.resetModules();
    process.env.GOOGLE_CLIENT_ID = 'id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetch);
    store = memoryStore();
    clock = Date.now();

    const { createSessionService } = await import('../sessions.mjs');
    const { parseEncryptionKey, generateEncryptionKey } = await import('../crypto.mjs');
    service = createSessionService({
      store,
      encryptionKey: parseEncryptionKey(generateEncryptionKey()),
      now: () => clock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  const count = (path) => google.calls.filter((c) => c.endsWith(path)).length;

  async function pairUntilReady(tv = TV_A) {
    await service.connect(tv);
    google.tokenReply = 'granted';
    google.sourcesSet = true;
    clock += 6000;
    return service.status(tv);
  }

  it('hands out a pairing code and reuses it rather than replacing it', async () => {
    const first = await service.connect(TV_A);
    const second = await service.connect(TV_A);

    expect(first).toMatchObject({ phase: 'pairing', userCode: 'HXFZ-JKTQ', verificationUrl: 'https://www.google.com/device' });
    expect(second.userCode).toBe('HXFZ-JKTQ');
    expect(count('/device/code')).toBe(1);
  });

  it("doesn't ask Google more often than Google's polling interval", async () => {
    await service.connect(TV_A);
    await service.status(TV_A);
    expect(count('/token')).toBe(0);

    clock += 6000;
    expect((await service.status(TV_A)).phase).toBe('pairing');
    expect(count('/token')).toBe(1);
  });

  it('moves to album choice once the phone approves', async () => {
    await service.connect(TV_A);
    google.tokenReply = 'granted';
    clock += 6000;

    const status = await service.status(TV_A);

    expect(status).toMatchObject({ phase: 'awaiting_sources', settingsUri: 'https://photos.google.com/frame/1' });
    expect(status.userCode).toBeNull();
  });

  it('checks for album choice at a throttled pace, then becomes ready', async () => {
    await service.connect(TV_A);
    google.tokenReply = 'granted';
    clock += 6000;
    await service.status(TV_A);
    const devicesAfterPairing = count('/devices/device-1');

    google.sourcesSet = true;
    await service.status(TV_A); // within 10 s: no Google call
    expect(count('/devices/device-1')).toBe(devicesAfterPairing);

    clock += 11000;
    expect((await service.status(TV_A)).phase).toBe('ready');
  });

  it('lists every page of media, then serves it from cache within the hour', async () => {
    await pairUntilReady();

    const first = await service.media(TV_A);
    expect(first.items).toHaveLength(150);
    expect(first.items[0].videoUrl).toMatch(/=dv$/);
    expect((await service.status(TV_A)).itemCount).toBe(150);

    const listCalls = count('/mediaItems');
    clock += 20 * 60 * 1000;
    await service.media(TV_A);
    expect(count('/mediaItems')).toBe(listCalls);

    clock += 35 * 60 * 1000; // past the 50-minute refresh point
    await service.media(TV_A);
    expect(count('/mediaItems')).toBeGreaterThan(listCalls);
  });

  it("keeps each TV's photos private to that TV", async () => {
    await pairUntilReady(TV_A);
    await service.media(TV_A);

    expect((await service.status(TV_B)).phase).toBe('disconnected');
    expect((await service.media(TV_B)).items).toEqual([]);
  });

  it('never stores Google tokens in plain text', async () => {
    await pairUntilReady();
    const stored = JSON.stringify([...store.sessions.values()]);
    expect(stored).not.toContain(REFRESH_TOKEN);
    expect(stored).not.toContain('access-1');
    expect(stored).not.toContain('dev-code');
  });

  it('shows a fresh QR when Google access has been revoked', async () => {
    await pairUntilReady();
    google.refreshFails = true;
    clock += 2 * 60 * 60 * 1000; // access token long expired

    const media = await service.media(TV_A);
    expect(media.items).toEqual([]);
    const status = await service.status(TV_A);
    expect(status.phase).toBe('disconnected');
    expect(status.message).toMatch(/Scan the code/);
  });

  it('forgets everything on disconnect, and revokes the token', async () => {
    await pairUntilReady();
    await service.media(TV_A);

    const status = await service.disconnect(TV_A);

    expect(status.phase).toBe('disconnected');
    expect(count('/revoke')).toBe(1);
    expect(store.sessions.size).toBe(0);
    expect(store.media.size).toBe(0);
  });

  it("doesn't write anything for a TV that has only asked for status", async () => {
    await service.status(TV_B);
    expect(store.sessions.size).toBe(0);
  });

  it('expires an unused code so the TV can fetch a new one', async () => {
    await service.connect(TV_A);
    clock += 31 * 60 * 1000;
    expect((await service.status(TV_A)).phase).toBe('disconnected');
  });
});
