// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileStore } from '../stores/fileStore.mjs';
import { createFirestoreStore } from '../stores/firestoreStore.mjs';

describe('file store (home helper)', () => {
  it('saves, reads and deletes sessions and media', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pf-store-'));
    try {
      const store = createFileStore(dir);
      expect(await store.getSession('abc')).toBeNull();

      await store.putSession('abc', { phase: 'ready' });
      await store.putMedia('abc', { refreshedAt: 1, items: [{ id: 'm1' }] });
      expect(await store.getSession('abc')).toEqual({ phase: 'ready' });
      expect((await store.getMedia('abc')).items).toHaveLength(1);

      await store.deleteSession('abc');
      await store.deleteMedia('abc');
      expect(await store.getSession('abc')).toBeNull();
      expect(await store.getMedia('abc')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Firestore store (Cloud Run)', () => {
  function fakeFirestore() {
    const docs = new Map();
    const fetchImpl = vi.fn(async (url, init = {}) => {
      const path = decodeURIComponent(new URL(url).pathname.split('/documents/')[1]);
      if (init.method === 'PATCH') {
        docs.set(path, JSON.parse(init.body));
        return new Response('{}', { status: 200 });
      }
      if (init.method === 'DELETE') {
        docs.delete(path);
        return new Response('{}', { status: 200 });
      }
      return docs.has(path)
        ? new Response(JSON.stringify(docs.get(path)), { status: 200 })
        : new Response('{}', { status: 404 });
    });
    const store = createFirestoreStore({ projectId: 'my-proj', fetchImpl, tokenProvider: async () => 'tok' });
    return { store, docs, fetchImpl };
  }

  it('writes each record as one JSON string field under the right project', async () => {
    const { store, fetchImpl } = fakeFirestore();
    await store.putSession('abc', { phase: 'pairing' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://firestore.googleapis.com/v1/projects/my-proj/databases/(default)/documents/sessions/abc');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body).fields.data.stringValue).toBe('{"phase":"pairing"}');
    expect(await store.getSession('abc')).toEqual({ phase: 'pairing' });
  });

  it('stamps every record with an expiry so abandoned screens are deleted', async () => {
    const { store, fetchImpl } = fakeFirestore();
    const before = Date.now();
    await store.putSession('abc', { phase: 'ready' });

    const expireAt = Date.parse(JSON.parse(fetchImpl.mock.calls[0][1].body).fields.expireAt.timestampValue);
    const days = (expireAt - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
  });

  it('lets short-lived records set their own, earlier expiry', async () => {
    const { store, fetchImpl } = fakeFirestore();
    const at = Date.parse('2026-10-05T12:15:00Z');
    await store.putDoc('sendCodes', 'ABCDEFGH', { sessionId: 's' }, { expireAt: at });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/\/documents\/sendCodes\/ABCDEFGH$/);
    expect(JSON.parse(init.body).fields.expireAt.timestampValue).toBe('2026-10-05T12:15:00.000Z');
  });

  it('treats a missing document as no session', async () => {
    const { store } = fakeFirestore();
    expect(await store.getSession('missing')).toBeNull();
  });

  it('splits a large media list across documents and reassembles it', async () => {
    const { store, docs } = fakeFirestore();
    const items = Array.from({ length: 4000 }, (_, i) => ({ id: `m${i}`, baseUrl: 'https://lh3.googleusercontent.com/'.padEnd(250, 'x') }));

    await store.putMedia('abc', { refreshedAt: 42, items });

    expect(docs.size).toBeGreaterThan(1); // over Firestore's 1 MiB document cap
    const back = await store.getMedia('abc');
    expect(back.refreshedAt).toBe(42);
    expect(back.items).toEqual(items);

    await store.deleteMedia('abc');
    expect(docs.size).toBe(0);
  });
});
