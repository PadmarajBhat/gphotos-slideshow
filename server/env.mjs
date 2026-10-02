import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(here, '..');

/**
 * Minimal .env reader. A dependency for this would be 15 lines of value and
 * a supply-chain surface, and this helper is meant to stay small.
 */
function readEnvFile() {
  const envPath = resolve(projectRoot, '.env');
  if (!existsSync(envPath)) return {};

  const parsed = {};
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export const config = {
  clientId: '',
  clientSecret: '',
  port: 4000,
  deviceName: 'LuminaFrame TV',
  // The Ambient API host is overridable because Google's reference pages are
  // inconsistent about whether devices live on photosambient or photoslibrary.
  ambientBase: 'https://photosambient.googleapis.com/v1',
  tokenFile: resolve(projectRoot, 'server/.tokens.json'),
};

/**
 * Re-read .env in place. Called again whenever the app is still unconfigured,
 * so adding credentials does not require restarting the helper.
 */
export function refreshConfig() {
  const fileEnv = readEnvFile();
  const get = (key, fallback = '') => (process.env[key] ?? fileEnv[key] ?? fallback).trim();

  config.clientId = get('GOOGLE_CLIENT_ID');
  config.clientSecret = get('GOOGLE_CLIENT_SECRET');
  config.port = Number(get('PORT', '4000'));
  config.deviceName = get('AMBIENT_DEVICE_NAME', 'LuminaFrame TV');
  config.ambientBase = get('AMBIENT_API_BASE', 'https://photosambient.googleapis.com/v1');
  config.tokenFile = resolve(projectRoot, get('TOKEN_FILE', 'server/.tokens.json'));
  return config;
}

refreshConfig();

export function assertConfigured() {
  const missing = [];
  if (!config.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!config.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');

  if (missing.length > 0) {
    return (
      `Missing ${missing.join(' and ')}.\n\n` +
      'Create a .env file in the project root containing:\n' +
      '  GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com\n' +
      '  GOOGLE_CLIENT_SECRET=your-secret\n\n' +
      'Both come from a Google Cloud OAuth client of type ' +
      '"TVs and Limited Input devices". See the README.'
    );
  }
  return null;
}
