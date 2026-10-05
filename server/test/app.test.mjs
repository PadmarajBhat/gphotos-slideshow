// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { createHandler, clientIp } from '../app.mjs';
import { sessionStorageId } from '../crypto.mjs';

const ALLOWED = 'https://padmarajbhat.github.io';
const SECRET = 'S'.repeat(43);

describe('Helper HTTP layer', () => {
  let server, base;
  const sessions = {
    status: vi.fn(async (id) => ({ phase: 'disconnected', id })),
    connect: vi.fn(async () => ({ phase: 'pairing' })),
    media: vi.fn(async () => ({ items: [] })),
    disconnect: vi.fn(async () => ({ phase: 'disconnected' })),
  };

  beforeAll(async () => {
    server = createServer(createHandler({ sessions, allowedOrigins: [ALLOWED], distDir: null }));
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => new Promise((r) => server.close(r)));

  const get = (path, headers = {}) => fetch(`${base}${path}`, { headers });

  it('answers health checks', async () => {
    expect((await get('/api/health')).status).toBe(200);
  });

  it('rejects requests without a valid TV session secret', async () => {
    expect((await get('/api/ambient/status')).status).toBe(400);
    expect((await get('/api/ambient/status', { 'X-Frame-Session': 'short' })).status).toBe(400);
  });

  it('looks sessions up by hash, never by the raw secret', async () => {
    const res = await get('/api/ambient/status', { 'X-Frame-Session': SECRET });
    const body = await res.json();
    expect(body.id).toBe(sessionStorageId(SECRET));
    expect(body.id).not.toContain(SECRET);
  });

  it('allows the GitHub Pages site cross-origin', async () => {
    const res = await get('/api/ambient/status', { 'X-Frame-Session': SECRET, Origin: ALLOWED });
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
  });

  it('gives other websites no CORS access', async () => {
    const res = await get('/api/ambient/status', { 'X-Frame-Session': SECRET, Origin: 'https://evil.example' });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers the CORS preflight, allowing the session header', async () => {
    const res = await fetch(`${base}/api/ambient/status`, { method: 'OPTIONS', headers: { Origin: ALLOWED } });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toMatch(/X-Frame-Session/);
  });

  it('rate-limits pairing-code requests from one address', async () => {
    const connect = () =>
      fetch(`${base}/api/ambient/connect`, {
        method: 'POST',
        headers: { 'X-Frame-Session': SECRET, 'X-Forwarded-For': '203.0.113.9' },
      });
    for (let i = 0; i < 10; i += 1) expect((await connect()).status).toBe(200);
    expect((await connect()).status).toBe(429);
  });

  it('hides internal error details from the browser', async () => {
    sessions.media.mockRejectedValueOnce(new Error('Firestore PATCH returned HTTP 403 for project secret-name'));
    const res = await get('/api/ambient/media', { 'X-Frame-Session': SECRET });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secret-name');
  });

  it('returns 404 for unknown endpoints', async () => {
    expect((await get('/api/ambient/nope', { 'X-Frame-Session': SECRET })).status).toBe(404);
  });
});

describe('Phone-to-TV routes', () => {
  let server, base;
  const inbox = {
    issueCode: vi.fn(async () => ({ code: 'ABCDEFGH', expiresAt: new Date().toISOString() })),
    collect: vi.fn(async () => ({ url: null })),
    deliver: vi.fn(async (code) => (code === 'ABCDEFGH' ? { ok: true } : { ok: false, reason: 'expired_code' })),
  };

  beforeAll(async () => {
    // As on Cloud Run, where the front end appends the caller's address.
    server = createServer(createHandler({ sessions: {}, inbox, allowedOrigins: [ALLOWED], distDir: null, trustProxy: true }));
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => new Promise((r) => server.close(r)));

  const send = (body, ip = '198.51.100.1') =>
    fetch(`${base}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify(body),
    });

  it('lets a phone send with only the code, no session', async () => {
    const res = await send({ code: 'ABCDEFGH', url: 'https://photos.app.goo.gl/x' });
    expect(res.status).toBe(200);
    expect(inbox.deliver).toHaveBeenCalledWith('ABCDEFGH', 'https://photos.app.goo.gl/x');
  });

  it('tells the phone to rescan when the code has expired', async () => {
    const res = await send({ code: 'ZZZZZZZZ', url: 'https://photos.app.goo.gl/x' }, '198.51.100.2');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/Scan the new QR/);
  });

  it('cuts off an address that keeps guessing codes', async () => {
    for (let i = 0; i < 10; i += 1) await send({ code: 'ZZZZZZZZ', url: 'x' }, '203.0.113.50');
    expect((await send({ code: 'ZZZZZZZZ', url: 'x' }, '203.0.113.50')).status).toBe(429);
  });

  it('can’t be dodged by forging the forwarding header', async () => {
    // Only the last entry is the proxy's; the rest is whatever the caller sent.
    for (let i = 0; i < 10; i += 1) await send({ code: 'ZZZZZZZZ', url: 'x' }, `10.0.0.${i}, 203.0.113.60`);
    expect((await send({ code: 'ZZZZZZZZ', url: 'x' }, '10.9.9.9, 203.0.113.60')).status).toBe(429);
  });

  it('requires the TV session to issue a code or read the inbox', async () => {
    expect((await fetch(`${base}/api/send-code`, { method: 'POST', body: '' })).status).toBe(400);
    expect((await fetch(`${base}/api/inbox`)).status).toBe(400);

    const ok = await fetch(`${base}/api/send-code`, { method: 'POST', body: '', headers: { 'X-Frame-Session': SECRET } });
    expect(ok.status).toBe(200);
    expect(inbox.issueCode).toHaveBeenCalledWith(sessionStorageId(SECRET));
  });
});

describe('clientIp', () => {
  const req = (xff, remoteAddress = '192.0.2.7') => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress } });

  it('ignores the forwarding header when nothing trusted sets it', () => {
    expect(clientIp(req('203.0.113.9'), false)).toBe('192.0.2.7');
  });

  it('takes the entry the trusted proxy appended', () => {
    expect(clientIp(req('6.6.6.6, 203.0.113.9'), true)).toBe('203.0.113.9');
    expect(clientIp(req(undefined), true)).toBe('192.0.2.7');
  });
});
