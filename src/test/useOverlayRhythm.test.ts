import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  bookendVisible,
  usePhotoBookends,
  useWeatherRhythm,
  videoBookendVisible,
} from '../hooks/useOverlayRhythm';

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Weather rhythm: 10 seconds every 2 minutes', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows for the first 10 seconds, then every 2 minutes', () => {
    const { result } = renderHook(() => useWeatherRhythm(true));
    expect(result.current).toBe(true);
    advance(10_000);
    expect(result.current).toBe(false);
    advance(109_000);
    expect(result.current).toBe(false);
    advance(1000); // 2:00
    expect(result.current).toBe(true);
    advance(10_000); // 2:10
    expect(result.current).toBe(false);
  });

  it('stays put when fading is switched off', () => {
    const { result } = renderHook(() => useWeatherRhythm(false));
    advance(10 * 60_000);
    expect(result.current).toBe(true);
  });
});

describe('Clock and photo info: a third of each photo’s time, as bookends', () => {
  it('shows the first sixth after loading and the last sixth before the change', () => {
    // A 60s photo that loaded at 0 and changes at 60s.
    const at = (s: number) => bookendVisible(s * 1000, 60_000, 0, 60_000);
    expect(at(0)).toBe(true);
    expect(at(9.9)).toBe(true);
    expect(at(10)).toBe(false);
    expect(at(30)).toBe(false);
    expect(at(49.9)).toBe(false);
    expect(at(50)).toBe(true);
    expect(at(59.9)).toBe(true);
  });

  it('counts the opening from when the photo loaded, not when the slide began', () => {
    // Took 4s to load; the slide still changes at 60s.
    expect(bookendVisible(12_000, 60_000, 4_000, 60_000)).toBe(true);
    expect(bookendVisible(14_000, 60_000, 4_000, 60_000)).toBe(false);
  });

  it('shows while the photo is still loading', () => {
    expect(bookendVisible(30_000, 60_000, null, 60_000)).toBe(true);
  });

  describe('usePhotoBookends', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('fades out and back in on time', () => {
      const start = Date.now();
      const { result } = renderHook(() => usePhotoBookends(true, 60_000, start, start + 60_000));
      expect(result.current).toBe(true);
      advance(10_100);
      expect(result.current).toBe(false);
      advance(40_000); // 50.1s
      expect(result.current).toBe(true);
    });

    it('keeps them up on slides under 20 seconds, and when fading is off', () => {
      const start = Date.now();
      expect(renderHook(() => usePhotoBookends(true, 10_000, start, start + 10_000)).result.current).toBe(true);
      const off = renderHook(() => usePhotoBookends(false, 60_000, start, start + 60_000));
      advance(30_000);
      expect(off.result.current).toBe(true);
    });
  });
});

describe('Clock and photo info on videos', () => {
  it('uses the video’s own length: the first and last sixth of it', () => {
    // A 3-minute video: shown for its first and last 30 seconds.
    expect(videoBookendVisible(true, 10, 180)).toBe(true);
    expect(videoBookendVisible(true, 31, 180)).toBe(false);
    expect(videoBookendVisible(true, 149, 180)).toBe(false);
    expect(videoBookendVisible(true, 151, 180)).toBe(true);
  });

  it('keeps them up on short clips, unknown lengths, and with fading off', () => {
    expect(videoBookendVisible(true, 8, 15)).toBe(true);
    expect(videoBookendVisible(true, 60, NaN)).toBe(true);
    expect(videoBookendVisible(false, 90, 180)).toBe(true);
  });
});
