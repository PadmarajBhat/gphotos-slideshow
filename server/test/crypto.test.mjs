// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  decrypt,
  encrypt,
  generateEncryptionKey,
  isValidSessionSecret,
  parseEncryptionKey,
  sessionStorageId,
} from '../crypto.mjs';

const key = parseEncryptionKey(generateEncryptionKey());

describe('token encryption', () => {
  it('round-trips a refresh token', () => {
    const sealed = encrypt('1//refresh-token-value', key);
    expect(sealed).not.toContain('refresh-token-value');
    expect(decrypt(sealed, key)).toBe('1//refresh-token-value');
  });

  it('produces a different ciphertext every time', () => {
    expect(encrypt('same', key)).not.toBe(encrypt('same', key));
  });

  it('rejects a tampered value instead of returning garbage', () => {
    const [prefix, iv, tag, body] = encrypt('secret', key).split('.');
    const flipped = Buffer.from(body, 'base64');
    flipped[0] ^= 1;
    expect(() => decrypt([prefix, iv, tag, flipped.toString('base64')].join('.'), key)).toThrow();
  });

  it('cannot be read with a different key', () => {
    const other = parseEncryptionKey(generateEncryptionKey());
    expect(() => decrypt(encrypt('secret', key), other)).toThrow();
  });

  it('passes null through untouched', () => {
    expect(encrypt(null, key)).toBeNull();
    expect(decrypt(null, key)).toBeNull();
  });

  it('insists on a 32-byte key', () => {
    expect(() => parseEncryptionKey(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
    expect(() => parseEncryptionKey('')).toThrow(/32 bytes/);
  });
});

describe('TV session secrets', () => {
  const secret = 'A'.repeat(43);

  it('accepts exactly 32 random bytes in base64url', () => {
    expect(isValidSessionSecret(secret)).toBe(true);
    expect(isValidSessionSecret('A'.repeat(42))).toBe(false);
    expect(isValidSessionSecret('A'.repeat(42) + '+')).toBe(false);
    expect(isValidSessionSecret(undefined)).toBe(false);
  });

  it('is stored under a hash, never as itself', () => {
    const id = sessionStorageId(secret);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toContain(secret);
    expect(sessionStorageId(secret)).toBe(id);
  });
});
