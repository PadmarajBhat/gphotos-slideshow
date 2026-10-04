// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { createHandler } from '../app.mjs';
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
