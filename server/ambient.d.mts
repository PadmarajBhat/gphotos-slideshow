import type { MediaItem } from '../src/types';

/** Full refresh cadence, kept inside the 60-minute baseUrl expiry. */
export const MEDIA_REFRESH_MS: number;

/** Google's cap: 240 Ambient API requests per device per day. */
export const DAILY_REQUEST_BUDGET: number;

export interface AmbientDevice {
  id: string;
  displayName: string;
  settingsUri: string | null;
  mediaSourcesSet: boolean;
  mediaSources: unknown[];
  pollingConfig: unknown | null;
}

export function createDevice(accessToken: string, displayName?: string): Promise<AmbientDevice>;

export function getDevice(accessToken: string, deviceId: string): Promise<AmbientDevice>;

export function listAllMediaItems(
  accessToken: string,
  deviceId: string,
  options?: { onProgress?: (count: number) => void }
): Promise<{ items: MediaItem[]; requests: number }>;

/** Maps an AmbientMediaItem onto the slideshow's MediaItem shape. */
export function mapMediaItem(raw: unknown): MediaItem | null;
