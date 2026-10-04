import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The home screen requests a pairing code automatically, so the helper must
 * not hand a second screen a new code that silently invalidates the first.
 */
describe('Helper pairing guard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers(); // keep the approval-polling loop from running
    vi.resetModules();
    process.env.GOOGLE_CLIENT_ID = 'test-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.TOKEN_FILE = join(tmpdir(), `luminaframe-test-${Date.now()}.json`);

    let issued = 0;
    fetchMock = vi.fn(async () => {
      issued += 1;
      return new Response(
        JSON.stringify({
          device_code: `device-${issued}`,
          user_code: `CODE-${issued}`,
          verification_url: 'https://www.google.com/device',
          expires_in: 1800,
          interval: 5,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.TOKEN_FILE;
  });

  async function freshState() {
    const { createAmbientState } = await import('../../server/state.mjs');
    return createAmbientState();
  }

  it('shares one request between screens that ask at the same moment', async () => {
    const ambient = await freshState();

    const [a, b] = await Promise.all([ambient.beginPairing(), ambient.beginPairing()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.userCode).toBe('CODE-1');
    expect(b.userCode).toBe('CODE-1');
    ambient.stop();
  });

  it('keeps showing the same code to a screen that asks again later', async () => {
    const ambient = await freshState();

    await ambient.beginPairing();
    const again = await ambient.beginPairing();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.userCode).toBe('CODE-1');
    ambient.stop();
  });

  it('issues a fresh code once the old one is about to expire', async () => {
    const ambient = await freshState();

    await ambient.beginPairing();
    vi.setSystemTime(Date.now() + 29.5 * 60 * 1000); // under a minute left
    const renewed = await ambient.beginPairing();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(renewed.userCode).toBe('CODE-2');
    ambient.stop();
  });
});
