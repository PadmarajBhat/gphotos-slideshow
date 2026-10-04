import { MediaItem } from '../types';

export type AmbientPhase =
  | 'unconfigured'
  | 'disconnected'
  | 'pairing'
  | 'awaiting_sources'
  | 'ready'
  | 'error'
  | 'offline';

export interface AmbientStatus {
  phase: AmbientPhase;
  message: string | null;
  userCode: string | null;
  verificationUrl: string | null;
  settingsUri: string | null;
  mediaSourcesSet: boolean;
  itemCount: number;
  lastRefreshedAt: string | null;
  requestsToday: number;
  deviceName: string;
}

/**
 * A static host (GitHub Pages) has no helper, and must never get one: the
 * helper has no login, so a public instance would show the owner's photos to
 * anyone holding the URL. Google Photos is therefore self-host only.
 */
export const IS_STATIC_HOSTING = import.meta.env.VITE_STATIC_HOSTING === 'true';

export const REPO_URL = import.meta.env.VITE_REPO_URL || '';

export const OFFLINE_STATUS: AmbientStatus = {
  phase: 'offline',
  message: IS_STATIC_HOSTING
    ? 'This public site cannot reach your Google Photos. That needs LuminaFrame running on a computer in your home, which keeps your photos private to your own network.'
    : 'The LuminaFrame helper is not running. Start it with "npm start" (or "npm run helper" during development) to use your own Google Photos.',
  userCode: null,
  verificationUrl: null,
  settingsUri: null,
  mediaSourcesSet: false,
  itemCount: 0,
  lastRefreshedAt: null,
  requestsToday: 0,
  deviceName: 'LuminaFrame TV',
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).error ?? detail;
    } catch {
      // Non-JSON error body; the status text will do.
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

/**
 * The helper is optional: without it the app still runs demo albums and
 * shared links, so a connection failure is a state, not an exception.
 */
export async function fetchAmbientStatus(): Promise<AmbientStatus> {
  // No helper can exist on a static host; skip the request rather than
  // polling a path that will always 404.
  if (IS_STATIC_HOSTING) return OFFLINE_STATUS;

  try {
    return await request<AmbientStatus>('/api/ambient/status');
  } catch {
    return OFFLINE_STATUS;
  }
}

export function startAmbientPairing(): Promise<AmbientStatus> {
  return request<AmbientStatus>('/api/ambient/connect', { method: 'POST' });
}

export function disconnectAmbient(): Promise<AmbientStatus> {
  return request<AmbientStatus>('/api/ambient/disconnect', { method: 'POST' });
}

export async function fetchAmbientMedia(): Promise<MediaItem[]> {
  const data = await request<{ items: MediaItem[] }>('/api/ambient/media');
  return data.items ?? [];
}
