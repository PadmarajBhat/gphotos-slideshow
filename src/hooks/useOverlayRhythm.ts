import { useEffect, useState } from 'react';

/**
 * Overlays that never move feel static when a photo stays up for a minute,
 * and on an OLED TV left on all day, fixed bright elements risk burn-in. So
 * they come and go:
 *
 * - Weather: 10 seconds every 2 minutes.
 * - Clock and photo info: a third of each photo's time on screen, split into
 *   bookends. The first sixth runs from when the photo loads, the last sixth
 *   up to when it changes, so the two meet across each change.
 */

/** Below this a slide is too short for fading to be anything but flicker. */
export const MIN_FADE_SLIDE_MS = 20_000;
export const WEATHER_SHOWN_MS = 10_000;
export const WEATHER_PERIOD_MS = 120_000;

/** Weather: shown for 10 seconds every 2 minutes, starting with the slideshow. */
export function useWeatherRhythm(enabled: boolean): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const hide = () => {
      setVisible(false);
      timer = setTimeout(show, WEATHER_PERIOD_MS - WEATHER_SHOWN_MS);
    };
    const show = () => {
      setVisible(true);
      timer = setTimeout(hide, WEATHER_SHOWN_MS);
    };
    timer = setTimeout(hide, WEATHER_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [enabled]);

  return enabled ? visible : true;
}

/**
 * Whether the bookend overlays show at `now`, for an item on screen for
 * `durationMs` that finished loading at `loadedAt` and changes at `endsAt`.
 * Shown while it is still loading, and when its end time isn't known.
 */
export function bookendVisible(now: number, durationMs: number, loadedAt: number | null, endsAt: number | null): boolean {
  const edge = durationMs / 6;
  if (loadedAt === null || now < loadedAt + edge) return true;
  return endsAt !== null && now >= endsAt - edge;
}

/**
 * The bookends for a photo, re-evaluated exactly at each boundary. Short
 * slides and fading switched off keep the overlays up throughout.
 */
export function usePhotoBookends(
  enabled: boolean,
  durationMs: number,
  loadedAt: number | null,
  endsAt: number | null
): boolean {
  const active = enabled && durationMs >= MIN_FADE_SLIDE_MS;
  // Bumped at each boundary, so the next render sees the new time.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const now = Date.now();
    const edge = durationMs / 6;
    const upcoming = [loadedAt === null ? null : loadedAt + edge, endsAt === null ? null : endsAt - edge].filter(
      (t): t is number => t !== null && t > now
    );
    if (upcoming.length === 0) return;
    const timer = setTimeout(() => setTick((n) => n + 1), Math.min(...upcoming) - now + 5);
    return () => clearTimeout(timer);
  });

  return active ? bookendVisible(Date.now(), durationMs, loadedAt, endsAt) : true;
}

/** The bookends for a video, from its own length and playback position. */
export function videoBookendVisible(enabled: boolean, currentTime: number, duration: number): boolean {
  if (!enabled || !Number.isFinite(duration) || duration * 1000 < MIN_FADE_SLIDE_MS) return true;
  const edge = duration / 6;
  return currentTime < edge || currentTime >= duration - edge;
}
