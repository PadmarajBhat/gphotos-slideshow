import { readFileSync, writeFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { config } from './env.mjs';

/**
 * Persists only the refresh token and the Ambient device id, so the frame can
 * come back after a reboot without someone re-pairing it from a phone.
 *
 * Deliberately NOT persisted: access tokens (short lived, kept in memory) and
 * anything about the photos themselves. Delete the file, or call
 * POST /api/ambient/disconnect, to revoke this machine's access locally.
 */
const EMPTY = { refreshToken: null, deviceId: null };

export function loadTokens() {
  try {
    if (!existsSync(config.tokenFile)) return { ...EMPTY };
    const parsed = JSON.parse(readFileSync(config.tokenFile, 'utf8'));
    return {
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveTokens(next) {
  try {
    writeFileSync(config.tokenFile, JSON.stringify(next, null, 2), { mode: 0o600 });
    // writeFileSync only applies mode when creating the file.
    chmodSync(config.tokenFile, 0o600);
  } catch (err) {
    console.error('[store] could not persist tokens:', err.message);
  }
}

export function clearTokens() {
  try {
    rmSync(config.tokenFile, { force: true });
  } catch (err) {
    console.error('[store] could not clear tokens:', err.message);
  }
}
