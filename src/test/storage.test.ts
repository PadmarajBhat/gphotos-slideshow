import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_CONFIG,
  loadConfig,
  migrateLegacyStorage,
  saveConfig,
  sanitizeConfig,
} from '../utils/storage';

describe('Preference storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing has been saved', () => {
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips saved preferences so a TV restart keeps them', () => {
    saveConfig({ ...DEFAULT_CONFIG, durationSeconds: 30, tempUnit: 'fahrenheit', clockFormat: '24h' });

    const loaded = loadConfig();
    expect(loaded.durationSeconds).toBe(30);
    expect(loaded.tempUnit).toBe('fahrenheit');
    expect(loaded.clockFormat).toBe('24h');
  });

  it('carries data saved under the old LuminaFrame keys across', () => {
    localStorage.setItem('luminaframe_config', JSON.stringify({ ...DEFAULT_CONFIG, durationSeconds: 30 }));
    localStorage.setItem('luminaframe_session', 'paired-secret');

    migrateLegacyStorage();

    expect(loadConfig().durationSeconds).toBe(30);
    expect(localStorage.getItem('gpicshow_session')).toBe('paired-secret');
    expect(localStorage.getItem('luminaframe_config')).toBeNull();
    expect(localStorage.getItem('luminaframe_session')).toBeNull();
  });

  it('never overwrites data already saved under the new keys', () => {
    localStorage.setItem('gpicshow_session', 'current');
    localStorage.setItem('luminaframe_session', 'stale');

    migrateLegacyStorage();

    expect(localStorage.getItem('gpicshow_session')).toBe('current');
    expect(localStorage.getItem('luminaframe_session')).toBeNull();
  });

  it('falls back to defaults for a corrupt payload', () => {
    localStorage.setItem('gpicshow_config', '{not json');
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('rejects out-of-range values field by field', () => {
    const sanitized = sanitizeConfig({
      durationSeconds: 9999,
      transitionEffect: 'explode',
      tempUnit: 'kelvin',
      clockFormat: '36h',
      showWeather: 'yes',
      fadeOverlays: 'sometimes',
    });

    expect(sanitized.durationSeconds).toBe(DEFAULT_CONFIG.durationSeconds);
    expect(sanitized.transitionEffect).toBe('random');
    expect(sanitized.tempUnit).toBe('celsius');
    expect(sanitized.clockFormat).toBe('12h');
    expect(sanitized.showWeather).toBe(true);
    expect(sanitized.fadeOverlays).toBe(true);
  });

  it('keeps valid values that differ from the defaults', () => {
    const sanitized = sanitizeConfig({
      durationSeconds: 5,
      transitionEffect: 'ken-burns',
      showClock: false,
      fadeOverlays: false,
    });

    expect(sanitized.durationSeconds).toBe(5);
    expect(sanitized.fadeOverlays).toBe(false);
    expect(sanitized.transitionEffect).toBe('ken-burns');
    expect(sanitized.showClock).toBe(false);
  });
});
