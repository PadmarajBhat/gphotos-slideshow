import { SlideshowConfig, TransitionType } from '../types';

const CONFIG_STORAGE_KEY = 'luminaframe_config';

export const DEFAULT_CONFIG: SlideshowConfig = {
  durationSeconds: 10,
  transitionEffect: 'random',
  tempUnit: 'celsius',
  clockFormat: '12h',
  showDetails: true,
  showWeather: true,
  showClock: true,
};

const VALID_DURATIONS = [5, 10, 15, 30, 60];
const VALID_TRANSITIONS: TransitionType[] = [
  'random',
  'crossfade',
  'ken-burns',
  'slide-left',
  'scale-up',
];

/**
 * Preferences are the only thing LuminaFrame persists. A corrupt or
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

export function saveConfig(config: SlideshowConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private browsing or a full quota must not break playback.
  }
}
