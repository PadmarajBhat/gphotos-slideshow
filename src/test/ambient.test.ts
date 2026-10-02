import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OFFLINE_STATUS,
  fetchAmbientStatus,
  fetchAmbientMedia,
  startAmbientPairing,
  disconnectAmbient,
} from '../api/ambient';

function jsonOk(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe('Ambient helper client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports offline rather than throwing when the helper is not running', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const status = await fetchAmbientStatus();

    expect(status.phase).toBe('offline');
    expect(status.message).toMatch(/helper is not running/i);
  });

  it('passes through the helper status when it is running', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonOk({ ...OFFLINE_STATUS, phase: 'ready', itemCount: 617 })
    );

    const status = await fetchAmbientStatus();

    expect(status.phase).toBe('ready');
    expect(status.itemCount).toBe(617);
  });

  it('returns every media item the helper holds, not a first page', async () => {
    const items = Array.from({ length: 617 }, (_, i) => ({ id: `m${i}` }));
    vi.mocked(fetch).mockResolvedValueOnce(jsonOk({ items }));

    const media = await fetchAmbientMedia();

    expect(media).toHaveLength(617);
  });

  it('tolerates a media response with no items array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonOk({}));
    await expect(fetchAmbientMedia()).resolves.toEqual([]);
  });

  it('POSTs to start pairing and to disconnect', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonOk(OFFLINE_STATUS));

    await startAmbientPairing();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/ambient/connect');
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).method).toBe('POST');

    await disconnectAmbient();
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/ambient/disconnect');
  });

  it('surfaces a helper error message instead of a bare status code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Ambient API 403: insufficient scope' }),
    } as unknown as Response);

    await expect(startAmbientPairing()).rejects.toThrow(/insufficient scope/);
  });
});
