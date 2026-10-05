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

export const IS_STATIC_HOSTING = import.meta.env.VITE_STATIC_HOSTING === 'true';

/**
 * Google Photos Ambient API pairing. Google only grants that API to members of
 * its Photos partner program (anyone else gets a 403 after approving on their
 * phone), so it stays off until the project is accepted. The helper code for
 * it remains in place; set VITE_AMBIENT_API=true to switch it on.
 */
export const AMBIENT_ENABLED = import.meta.env.VITE_AMBIENT_API === 'true';

/**
 * Where the photo helper lives. Empty means the same origin (the home
 * helper, or the dev server's proxy). The GitHub Pages build points this at
 * the Cloud Run helper.
 */
export const HELPER_URL = (import.meta.env.VITE_HELPER_URL ?? '').replace(/\/$/, '');

/** A static build with no helper configured has nothing to talk to. */
export const HAS_HELPER = !IS_STATIC_HOSTING || HELPER_URL !== '';

export const REPO_URL = import.meta.env.VITE_REPO_URL || '';

export const OFFLINE_STATUS: AmbientStatus = {
  phase: 'offline',
  message: 'The photo service is unavailable right now.',
  userCode: null,
  verificationUrl: null,
  settingsUri: null,
  mediaSourcesSet: false,
  itemCount: 0,
  lastRefreshedAt: null,
  requestsToday: 0,
  deviceName: 'Photo Frame',
};

const SESSION_KEY = 'gpicshow_session';
const SESSION_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let memorySession: string | null = null;

/**
 * This screen's private pairing secret: 32 random bytes, made here and kept
 * in localStorage. The helper keys each TV's Google connection to it, so one
 * TV can never see another's photos.
 */
export function getFrameSession(): string {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored && SESSION_PATTERN.test(stored)) return stored;
  } catch {
    // Storage unavailable: fall back to a secret for this page load only.
  }
  if (memorySession) return memorySession;

  const secret = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  try {
    localStorage.setItem(SESSION_KEY, secret);
  } catch {
    memorySession = secret;
  }
  return secret;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${HELPER_URL}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), 'X-Frame-Session': getFrameSession() },
  });
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
 * The helper is optional: without it the app still runs the demo and shared
 * links, so a connection failure is a state, not an exception.
 */
export async function fetchAmbientStatus(): Promise<AmbientStatus> {
  if (!HAS_HELPER) return OFFLINE_STATUS;
  try {
    return await request<AmbientStatus>('/api/ambient/status');
  } catch {
    return OFFLINE_STATUS;
  }
}

export function startAmbientPairing(): Promise<AmbientStatus> {
  // An explicit empty body guarantees Content-Length: 0, which Cloud Run's
  // front end requires on POST; some browsers omit it when there's no body.
  return request<AmbientStatus>('/api/ambient/connect', { method: 'POST', body: '' });
}

export function disconnectAmbient(): Promise<AmbientStatus> {
  return request<AmbientStatus>('/api/ambient/disconnect', { method: 'POST', body: '' });
}

export async function fetchAmbientMedia(): Promise<MediaItem[]> {
  const data = await request<{ items: MediaItem[] }>('/api/ambient/media');
  return data.items ?? [];
}
