import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  CLOCK_RHYTHM,
  WEATHER_RHYTHM,
  useDetailsRhythm,
  useOverlayRhythm,
} from '../hooks/useOverlayRhythm';

// random() = 0.5 makes the jitter exactly 1x, so the timings are predictable.
const steady = () => 0.5;
const MINUTE = 60_000;

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('useOverlayRhythm', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fades the clock out briefly every few slides, then brings it back', () => {
    const { result } = renderHook(() => useOverlayRhythm(true, MINUTE, CLOCK_RHYTHM, steady));
    expect(result.current).toBe(true);

    advance(4 * MINUTE - 1);
    expect(result.current).toBe(true);
    advance(1);
    expect(result.current).toBe(false);

    advance(30_000); // half a slide
    expect(result.current).toBe(true);
  });

  it('keeps the weather out of step with the clock', () => {
    const clock = renderHook(() => useOverlayRhythm(true, MINUTE, CLOCK_RHYTHM, steady));
    const weather = renderHook(() => useOverlayRhythm(true, MINUTE, WEATHER_RHYTHM, steady));

    advance(4 * MINUTE);
    expect(clock.result.current).toBe(false);
    expect(weather.result.current).toBe(true);
    advance(30_000);
    expect(weather.result.current).toBe(false);
    expect(clock.result.current).toBe(true);
  });

  it('never leaves the clock away for long, however long the slides', () => {
    const { result } = renderHook(() =>
      useOverlayRhythm(true, 10 * MINUTE, { shown: 1, hidden: 1 }, steady)
    );
    advance(10 * MINUTE);
    expect(result.current).toBe(false);
    advance(45_000);
    expect(result.current).toBe(true);
  });

  it('doesn’t flicker on short slides: they are timed as if 20 seconds long', () => {
    const { result } = renderHook(() => useOverlayRhythm(true, 5000, CLOCK_RHYTHM, steady));
    advance(4 * 5000);
    expect(result.current).toBe(true);
    advance(4 * 20_000 - 4 * 5000);
    expect(result.current).toBe(false);
  });

  it('stays put when fading is switched off', () => {
    const { result } = renderHook(() => useOverlayRhythm(false, MINUTE, CLOCK_RHYTHM, steady));
    advance(60 * MINUTE);
    expect(result.current).toBe(true);
  });
});

describe('useDetailsRhythm', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows each photo’s details, then leaves a long slide to the photo', () => {
    const { result, rerender } = renderHook(({ id }) => useDetailsRhythm(true, MINUTE, id, steady), {
      initialProps: { id: 'a' },
    });
    advance(37_000); // 0.625 of the slide
    expect(result.current).toBe(true);
    advance(1000);
    expect(result.current).toBe(false);

    rerender({ id: 'b' });
    expect(result.current).toBe(true);
  });

  it('keeps details up throughout short slides', () => {
    const { result } = renderHook(() => useDetailsRhythm(true, 10_000, 'a', steady));
    advance(60_000);
    expect(result.current).toBe(true);
  });
});
