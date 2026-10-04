import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Google refresh tokens are long-lived keys to someone's photos. They are
 * encrypted before they reach any store, so a leaked database or data file
 * is useless without TOKEN_ENCRYPTION_KEY, which lives in Secret Manager.
 */
const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'v1';

export function parseEncryptionKey(base64) {
  const key = Buffer.from(base64 ?? '', 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.');
  }
  return key;
}

export function generateEncryptionKey() {
  return randomBytes(32).toString('base64');
}

export function encrypt(plaintext, key) {
  if (plaintext == null) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), body.toString('base64')].join('.');
}

export function decrypt(sealed, key) {
  if (sealed == null) return null;
  const [prefix, iv, tag, body] = String(sealed).split('.');
  if (prefix !== PREFIX || !iv || !tag || !body) throw new Error('Unrecognised encrypted value');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}

/**
 * Sessions are stored under a hash of the TV's secret, never the secret
 * itself, so even someone who can list the store can't impersonate a TV.
 */
export function sessionStorageId(sessionSecret) {
  return createHash('sha256').update(sessionSecret).digest('hex');
}

/** 32 random bytes, base64url: what the browser generates for each TV. */
const SESSION_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isValidSessionSecret(value) {
  return typeof value === 'string' && SESSION_PATTERN.test(value);
}
