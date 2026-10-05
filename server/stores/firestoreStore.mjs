/**
 * Firestore store for Cloud Run, over the REST API with the service
 * account token from the metadata server. No client library, so the helper
 * stays dependency-free.
 *
 * Each record is a single string field holding JSON. Token fields inside it
 * are already encrypted by the caller.
 */

const METADATA = 'http://metadata.google.internal/computeMetadata/v1';

/** Firestore documents cap at 1 MiB; keep media chunks well under it. */
const MEDIA_CHUNK_CHARS = 700_000;

/**
 * Every write pushes this expiry forward; a Firestore TTL policy on
 * `expireAt` deletes records for screens unused this long. That is the
 * retention period the privacy policy promises.
 */
export const RETENTION_DAYS = 90;

export function createFirestoreStore({ projectId, fetchImpl = fetch, tokenProvider } = {}) {
  let cachedToken = null;
  let cachedProject = projectId ?? null;

  async function metadata(path) {
    const res = await fetchImpl(`${METADATA}${path}`, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!res.ok) throw new Error(`Metadata server returned HTTP ${res.status}`);
    return res;
  }

  async function accessToken() {
    if (tokenProvider) return tokenProvider();
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
    const body = await (await metadata('/instance/service-accounts/default/token')).json();
    cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return cachedToken.value;
  }

  async function project() {
    if (!cachedProject) cachedProject = (await (await metadata('/project/project-id')).text()).trim();
    return cachedProject;
  }

  async function docUrl(collection, id) {
    return `https://firestore.googleapis.com/v1/projects/${await project()}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
  }

  async function call(method, url, body) {
    const res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404 && method !== 'PATCH') return null;
    if (!res.ok) throw new Error(`Firestore ${method} returned HTTP ${res.status}`);
    return method === 'DELETE' ? null : res.json();
  }

  async function read(collection, id) {
    const doc = await call('GET', await docUrl(collection, id));
    const raw = doc?.fields?.data?.stringValue;
    return raw ? JSON.parse(raw) : null;
  }

  async function write(collection, id, value) {
    const expireAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await call('PATCH', await docUrl(collection, id), {
      fields: {
        data: { stringValue: JSON.stringify(value) },
        expireAt: { timestampValue: expireAt },
      },
    });
  }

  async function remove(collection, id) {
    await call('DELETE', await docUrl(collection, id));
  }

  return {
    name: 'firestore',
    getSession: (id) => read('sessions', id),
    putSession: (id, value) => write('sessions', id, value),
    deleteSession: (id) => remove('sessions', id),

    async getMedia(id) {
      const head = await read('media', id);
      if (!head) return null;
      let json = head.chunk;
      for (let i = 1; i < head.chunks; i += 1) {
        const part = await read('media', `${id}_${i}`);
        if (!part) return null;
        json += part.chunk;
      }
      return { refreshedAt: head.refreshedAt, items: JSON.parse(json) };
    },

    async putMedia(id, value) {
      const json = JSON.stringify(value.items);
      const chunks = Math.max(1, Math.ceil(json.length / MEDIA_CHUNK_CHARS));
      for (let i = chunks - 1; i >= 0; i -= 1) {
        const chunk = json.slice(i * MEDIA_CHUNK_CHARS, (i + 1) * MEDIA_CHUNK_CHARS);
        // Write the head last, so a reader never sees a head pointing at
        // chunks that don't exist yet.
        if (i === 0) await write('media', id, { refreshedAt: value.refreshedAt, chunks, chunk });
        else await write('media', `${id}_${i}`, { chunk });
      }
    },

    async deleteMedia(id) {
      const head = await read('media', id);
      const chunks = head?.chunks ?? 1;
      for (let i = 1; i < chunks; i += 1) await remove('media', `${id}_${i}`);
      await remove('media', id);
    },
  };
}
