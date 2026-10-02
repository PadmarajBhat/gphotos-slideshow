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

export const OFFLINE_STATUS: AmbientStatus = {
  phase: 'offline',
  message:
    'The LuminaFrame helper is not running. Start it with "npm start" (or "npm run helper" during development) to use your own Google Photos.',
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
