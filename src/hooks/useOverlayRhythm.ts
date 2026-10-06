import { useEffect, useState } from 'react';

/**
 * Overlays that never move feel static when a photo stays up for a minute,
 * and on an OLED TV left on all day, fixed bright elements risk burn-in. So
 * each overlay fades out and back on its own rhythm: proportional to the slide
 * duration, with some randomness, and offset so they never vanish or return
 * together.
 */

/** Below this a slide is too short for fading to be anything but flicker. */
export const MIN_UNIT_MS = 20_000;
/** However long the slides, the clock is never gone for longer than this. */
const MAX_HIDDEN_MS = 45_000;

/** Durations are in slides. */
export interface OverlayRhythm {
  shown: number;
  hidden: number;
  /** Extra slides before the first fade, to keep this overlay out of step with the others. */
  offset?: number;
}

export const CLOCK_RHYTHM: OverlayRhythm = { shown: 4, hidden: 0.5 };
export const WEATHER_RHYTHM: OverlayRhythm = { shown: 3, hidden: 0.6, offset: 1.5 };

/** 0.75x to 1.25x, so the cycles drift instead of repeating exactly. */
const jitter = (random: () => number) => 0.75 + random() * 0.5;

/** Whether an overlay is showing right now. Always true when `enabled` is off. */
export function useOverlayRhythm(
  enabled: boolean,
  slideMs: number,
  { shown, hidden, offset = 0 }: OverlayRhythm,
  random: () => number = Math.random
): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (!enabled) return;
    const unit = Math.max(MIN_UNIT_MS, slideMs);
    let timer: ReturnType<typeof setTimeout>;
    const hide = () => {
      setVisible(false);
      timer = setTimeout(show, Math.min(MAX_HIDDEN_MS, unit * hidden * jitter(random)));
    };
    const show = () => {
      setVisible(true);
      timer = setTimeout(hide, unit * shown * jitter(random));
    };
    timer = setTimeout(hide, unit * (shown + offset) * jitter(random));
    return () => clearTimeout(timer);
  }, [enabled, slideMs, shown, hidden, offset, random]);

  return enabled ? visible : true;
}

/**
 * Photo details belong to the photo, so they arrive with each one and, on a
 * long slide, fade out halfway to three quarters through, leaving the photo
 * the screen to itself.
 */
export function useDetailsRhythm(
  enabled: boolean,
  slideMs: number,
  itemKey: string | undefined,
  random: () => number = Math.random
): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (!enabled || slideMs < MIN_UNIT_MS) return;
    const timer = setTimeout(() => setVisible(false), slideMs * (0.5 + random() * 0.25));
    return () => clearTimeout(timer);
  }, [enabled, slideMs, itemKey, random]);

  return enabled ? visible : true;
}
