// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createInbox, generateCode, normaliseCode, CODE_TTL_MS, PENDING_LINK_TTL_MS } from '../inbox.mjs';
import { generateEncryptionKey, parseEncryptionKey } from '../crypto.mjs';

const LINK = 'https://photos.app.goo.gl/SjfyPTNv2Ccz4Swf7';

function memoryStore() {
  const docs = new Map();
  const expiries = new Map();
  const k = (c, id) => `${c}/${id}`;
  return {
    docs,
    expiries,
    getDoc: async (c, id) => structuredClone(docs.get(k(c, id)) ?? null),
    putDoc: async (c, id, v, opts) => {
      docs.set(k(c, id), structuredClone(v));
      expiries.set(k(c, id), opts?.expireAt);
    },
    deleteDoc: async (c, id) => void docs.delete(k(c, id)),
  };
}

describe('Phone-to-TV inbox', () => {
  let store, clock, inbox;
  const TV_A = 'a'.repeat(64);
  const TV_B = 'b'.repeat(64);

  beforeEach(() => {
    store = memoryStore();
    clock = Date.now();
    inbox = createInbox({ store, encryptionKey: parseEncryptionKey(generateEncryptionKey()), now: () => clock });
  });

  it('hands the TV an 8-character code from an unambiguous alphabet', async () => {
    const { code } = await inbox.issueCode(TV_A);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(code).not.toMatch(/[01ILO]/);
  });

  it('keeps showing the same code while it is still valid', async () => {
    const first = await inbox.issueCode(TV_A);
    clock += 5 * 60 * 1000;
    expect((await inbox.issueCode(TV_A)).code).toBe(first.code);
  });

  it('replaces a code that is about to expire, retiring the old one', async () => {
    const first = await inbox.issueCode(TV_A);
    clock += CODE_TTL_MS - 60 * 1000;
    const second = await inbox.issueCode(TV_A);
    expect(second.code).not.toBe(first.code);
    expect((await inbox.deliver(first.code, LINK)).ok).toBe(false);
  });

  it('delivers a link from the phone to the TV that showed the code', async () => {
    const { code } = await inbox.issueCode(TV_A);
    expect((await inbox.deliver(code, LINK)).ok).toBe(true);
    expect((await inbox.collect(TV_A)).url).toBe(LINK);
  });

  it('hands each link over once', async () => {
    const { code } = await inbox.issueCode(TV_A);
    await inbox.deliver(code, LINK);
    await inbox.collect(TV_A);
    expect((await inbox.collect(TV_A)).url).toBeNull();
  });

  it('spends the code, so a second send is refused', async () => {
    const { code } = await inbox.issueCode(TV_A);
    await inbox.deliver(code, LINK);
    expect((await inbox.deliver(code, LINK)).ok).toBe(false);
  });

  it('refuses an expired code', async () => {
    const { code } = await inbox.issueCode(TV_A);
    clock += CODE_TTL_MS + 1000;
    expect(await inbox.deliver(code, LINK)).toEqual({ ok: false, reason: 'expired_code' });
  });

  it('never delivers to a different TV', async () => {
    const { code } = await inbox.issueCode(TV_A);
    await inbox.issueCode(TV_B);
    await inbox.deliver(code, LINK);
    expect((await inbox.collect(TV_B)).url).toBeNull();
    expect((await inbox.collect(TV_A)).url).toBe(LINK);
  });

  it('accepts a code typed with lowercase letters, spaces or a dash', async () => {
    const { code } = await inbox.issueCode(TV_A);
    const typed = `${code.slice(0, 4).toLowerCase()} - ${code.slice(4)}`;
    expect((await inbox.deliver(typed, LINK)).ok).toBe(true);
  });

  it('rejects non-Google links, and keeps the code so the user can correct it', async () => {
    const { code } = await inbox.issueCode(TV_A);
    await expect(inbox.deliver(code, 'https://evil.example.com/x')).rejects.toThrow(/not an allowed/);
    await expect(inbox.deliver(code, 'http://photos.app.goo.gl/x')).rejects.toThrow(/https/);
    expect((await inbox.deliver(code, LINK)).ok).toBe(true);
  });

  it('drops a link the TV did not pick up within the hour, instead of playing it later', async () => {
    const { code } = await inbox.issueCode(TV_A);
    await inbox.deliver(code, LINK);
    clock += PENDING_LINK_TTL_MS + 1000;
    expect((await inbox.collect(TV_A)).url).toBeNull();
    expect(JSON.stringify([...store.docs.values()])).not.toMatch(/"pendingLink":"/);
  });

  it('asks the database to delete codes when they lapse, and idle inboxes within a day', async () => {
    const { code, expiresAt } = await inbox.issueCode(TV_A);
    expect(store.expiries.get(`sendCodes/${code}`)).toBe(Date.parse(expiresAt));
    const inboxExpiry = store.expiries.get(`inboxes/${TV_A}`);
    expect(inboxExpiry - clock).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('stores the link encrypted', async () => {
    const { code } = await inbox.issueCode(TV_A);
    await inbox.deliver(code, LINK);
    expect(JSON.stringify([...store.docs.values()])).not.toContain('SjfyPTNv2Ccz4Swf7');
  });

  it('only accepts well-formed codes', () => {
    expect(normaliseCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normaliseCode('ABCDEFG')).toBeNull();
    expect(normaliseCode('ABCDEFG0')).toBeNull(); // 0 is not in the alphabet
    expect(normaliseCode(undefined)).toBeNull();
    expect(new Set(Array.from({ length: 200 }, generateCode)).size).toBe(200);
  });
});
