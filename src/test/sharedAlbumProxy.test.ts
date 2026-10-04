import { describe, it, expect, vi } from 'vitest';
import { assertAllowedTarget, fetchAlbumHtml } from '../../server/sharedAlbumProxy.mjs';

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
  return new Response(status >= 300 && status < 400 ? null : body, { status, headers });
}

describe('Server-side shared album proxy', () => {
  describe('allowlist', () => {
    it('accepts Google Photos hosts over https', () => {
      expect(assertAllowedTarget('https://photos.app.goo.gl/abc').hostname).toBe('photos.app.goo.gl');
      expect(assertAllowedTarget('https://photos.google.com/share/xyz').hostname).toBe('photos.google.com');
    });

    it('refuses plain http, so the proxy cannot reach internal services', () => {
      expect(() => assertAllowedTarget('http://169.254.169.254/latest/meta-data/')).toThrow(/https/);
      expect(() => assertAllowedTarget('http://localhost:4000/api/ambient/status')).toThrow(/https/);
    });

    it('refuses any other https host', () => {
      expect(() => assertAllowedTarget('https://example.com/')).toThrow(/not an allowed/);
    });
  });

  describe('fetching', () => {
    it('follows an allowed redirect chain and returns the page', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(response(302, '', { location: 'https://photos.google.com/share/abc' }))
        .mockResolvedValueOnce(response(200, '<html>album</html>'));

      const html = await fetchAlbumHtml(new URL('https://photos.app.goo.gl/abc'), { fetchImpl });

      expect(html).toBe('<html>album</html>');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('stops at a redirect to a host outside the allowlist', async () => {
      // A Google redirect must not be able to aim the proxy at an arbitrary
      // destination. This is the bypass that automatic redirect-following allows.
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(response(302, '', { location: 'https://evil.example.com/steal' }));

      await expect(
        fetchAlbumHtml(new URL('https://photos.app.goo.gl/abc'), { fetchImpl })
      ).rejects.toThrow(/not an allowed/);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('never lets fetch follow redirects on its own', async () => {
      const fetchImpl = vi.fn().mockResolvedValueOnce(response(200, 'ok'));
      await fetchAlbumHtml(new URL('https://photos.google.com/share/abc'), { fetchImpl });
      expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    });

    it('gives up after too many redirects', async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(response(302, '', { location: 'https://photos.google.com/loop' }));

      await expect(
        fetchAlbumHtml(new URL('https://photos.google.com/start'), { fetchImpl })
      ).rejects.toThrow(/Too many redirects/);
    });

    it('reports an upstream error status', async () => {
      const fetchImpl = vi.fn().mockResolvedValueOnce(response(404, 'gone'));
      await expect(
        fetchAlbumHtml(new URL('https://photos.google.com/share/missing'), { fetchImpl })
      ).rejects.toThrow(/HTTP 404/);
    });
  });
});
