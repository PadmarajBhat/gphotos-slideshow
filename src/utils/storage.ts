import { MediaFilter, PlayOrder, SlideshowConfig, TransitionType } from '../types';

const CONFIG_STORAGE_KEY = 'gpicshow_config';

export const DEFAULT_CONFIG: SlideshowConfig = {
  durationSeconds: 10,
  transitionEffect: 'random',
  tempUnit: 'celsius',
  clockFormat: '12h',
  showDetails: true,
  showWeather: true,
  showClock: true,
  fadeOverlays: true,
  mediaFilter: 'all',
  playOrder: 'album',
  videoSound: true,
  videoDiagnostics: false,
};

const VALID_ORDERS: PlayOrder[] = ['album', 'newest', 'oldest', 'shuffle'];

const VALID_FILTERS: MediaFilter[] = ['all', 'photos', 'videos'];

const VALID_DURATIONS = [5, 10, 15, 30, 60];
const VALID_TRANSITIONS: TransitionType[] = [
  'random',
  'crossfade',
  'ken-burns',
  'slide-left',
  'scale-up',
];

/**
 * Preferences are the only thing GPicShow persists. A corrupt or
 * hand-edited blob must never stop the frame from starting, so every field
 * falls back to its default independently.
 */
export function sanitizeConfig(raw: unknown): SlideshowConfig {
  const input = (raw ?? {}) as Partial<SlideshowConfig>;

  return {
    durationSeconds: VALID_DURATIONS.includes(input.durationSeconds as number)
      ? (input.durationSeconds as number)
      : DEFAULT_CONFIG.durationSeconds,
    transitionEffect: VALID_TRANSITIONS.includes(input.transitionEffect as TransitionType)
      ? (input.transitionEffect as TransitionType)
      : DEFAULT_CONFIG.transitionEffect,
    tempUnit: input.tempUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    clockFormat: input.clockFormat === '24h' ? '24h' : '12h',
    showDetails: typeof input.showDetails === 'boolean' ? input.showDetails : true,
    showWeather: typeof input.showWeather === 'boolean' ? input.showWeather : true,
    showClock: typeof input.showClock === 'boolean' ? input.showClock : true,
    fadeOverlays: typeof input.fadeOverlays === 'boolean' ? input.fadeOverlays : DEFAULT_CONFIG.fadeOverlays,
    mediaFilter: VALID_FILTERS.includes(input.mediaFilter as MediaFilter)
      ? (input.mediaFilter as MediaFilter)
      : DEFAULT_CONFIG.mediaFilter,
    playOrder: VALID_ORDERS.includes(input.playOrder as PlayOrder)
      ? (input.playOrder as PlayOrder)
      : DEFAULT_CONFIG.playOrder,
    videoSound: typeof input.videoSound === 'boolean' ? input.videoSound : DEFAULT_CONFIG.videoSound,
    videoDiagnostics: typeof input.videoDiagnostics === 'boolean' ? input.videoDiagnostics : DEFAULT_CONFIG.videoDiagnostics,
  };
}

export function loadConfig(): SlideshowConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;
    return sanitizeConfig(JSON.parse(stored));
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Keys written before the project was renamed from LuminaFrame. */
const LEGACY_KEYS: Record<string, string> = {
  luminaframe_config: 'gpicshow_config',
  luminaframe_recent: 'gpicshow_recent',
  luminaframe_session: 'gpicshow_session',
};

/**
 * Carries data saved under the old name across, so an updated TV keeps its
 * preferences, recent albums and Google pairing. Run once before rendering.
 */
export function migrateLegacyStorage(): void {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  } catch {
    // Storage unavailable: there is nothing to carry over.
  }
}

export function saveConfig(config: SlideshowConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private browsing or a full quota must not break playback.
  }
}
