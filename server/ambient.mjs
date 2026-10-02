import { randomUUID } from 'node:crypto';
import { config } from './env.mjs';

const MAX_PAGE_SIZE = 100;

/**
 * Google caps Ambient calls at 240 requests per device per day. A 600-item
 * album costs 6 paged requests, so a full refresh every 50 minutes is about
 * 173 requests/day and leaves room for device polling.
 */
export const MEDIA_REFRESH_MS = 50 * 60 * 1000;
export const DAILY_REQUEST_BUDGET = 240;

async function ambientFetch(accessToken, path, init = {}) {
  const res = await fetch(`${config.ambientBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 400) };
  }

  if (!res.ok) {
    const message = body?.error?.message || body?.raw || res.statusText;
    const err = new Error(`Ambient API ${res.status}: ${message}`);
    err.status = res.status;
    err.googleStatus = body?.error?.status;
    throw err;
  }

  return body;
}

export async function createDevice(accessToken, displayName = config.deviceName) {
  const device = await ambientFetch(accessToken, '/devices', {
    method: 'POST',
    body: JSON.stringify({ displayName: `${displayName} ${randomUUID().slice(0, 8)}` }),
  });
  return normaliseDevice(device);
}

export async function getDevice(accessToken, deviceId) {
  const device = await ambientFetch(accessToken, `/devices/${encodeURIComponent(deviceId)}`);
  return normaliseDevice(device);
}

function normaliseDevice(device) {
  return {
    id: device.id,
    displayName: device.displayName,
    settingsUri: device.settingsUri ?? null,
    mediaSourcesSet: Boolean(device.mediaSourcesSet),
    mediaSources: device.mediaSources ?? [],
    pollingConfig: device.pollingConfig ?? null,
  };
}

/**
 * Walks every page so the slideshow gets the whole configured selection
 * rather than the first batch.
 */
export async function listAllMediaItems(accessToken, deviceId, { onProgress } = {}) {
  const items = [];
  let pageToken;
  let requests = 0;

  do {
    const params = new URLSearchParams({ deviceId, pageSize: String(MAX_PAGE_SIZE) });
    if (pageToken) params.set('pageToken', pageToken);

    const page = await ambientFetch(accessToken, `/mediaItems?${params.toString()}`);
    requests += 1;

    for (const raw of page.mediaItems ?? []) {
      const mapped = mapMediaItem(raw);
      if (mapped) items.push(mapped);
    }

    onProgress?.(items.length);
    pageToken = page.nextPageToken;

    // Never let a malformed nextPageToken loop burn the daily budget.
    if (requests >= DAILY_REQUEST_BUDGET / 4) break;
  } while (pageToken);

  return { items, requests };
}

/**
 * Maps an AmbientMediaItem onto the MediaItem shape the slideshow already
 * understands. Videos are identified by mimeType and get the =dv streaming
 * URL; photos get a TV-sized variant.
 */
export function mapMediaItem(raw) {
  const file = raw?.mediaFile;
  if (!file?.baseUrl) return null;

  const mimeType = file.mimeType || 'image/jpeg';
  const isVideo = mimeType.startsWith('video/');
  const meta = file.mediaFileMetadata ?? {};

  return {
    id: raw.id,
    baseUrl: isVideo ? `${file.baseUrl}=dv` : `${file.baseUrl}=w2560-h1440`,
    videoUrl: isVideo ? `${file.baseUrl}=dv` : undefined,
    mimeType,
    filename: file.filename || '',
    mediaMetadata: {
      creationTime: raw.createTime || '',
      width: String(meta.width ?? ''),
      height: String(meta.height ?? ''),
      ...(isVideo ? { video: { status: 'READY' } } : {}),
    },
  };
}
