import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MediaItem, PlayOrder, TransitionType } from '../types';
import { getRandomTransition } from '../utils/transitions';
import { isVideoItem, preloadImage } from '../utils/mediaUrls';
import { buildSequence, freshSeed } from '../utils/playOrder';
import { loadProgress, saveProgress } from '../utils/playProgress';

interface UseSlideshowOptions {
  items: MediaItem[];
  durationSeconds: number;
  transitionEffect: TransitionType;
  /** Defaults to the album's own order. */
  order?: PlayOrder;
  /** When given, progress is saved under it and resumed next time. */
  albumKey?: string;
}

/** Where the slideshow is: a position within one pass through the album. */
interface Nav {
  pos: number;
  /** Shuffle seed for this pass (unused by the other orders). */
  seed: number;
  /** The pass before this one, so Back can step into it. */
  prevSeed: number | null;
  /** The pass Back stepped out of, so Next returns to it rather than a new one. */
  forwardSeed: number | null;
}

/** Carry on from the saved item, if this album was last played in the same order. */
function startNav(items: MediaItem[], order: PlayOrder, albumKey?: string): Nav {
  const saved = albumKey ? loadProgress(albumKey) : null;
  if (saved && saved.order === order) {
    const sequence = buildSequence(items, order, saved.seed);
    const pos = sequence.findIndex((i) => items[i]?.id === saved.itemId);
    return { pos: Math.max(0, pos), seed: saved.seed, prevSeed: saved.prevSeed, forwardSeed: null };
  }
  return { pos: 0, seed: order === 'shuffle' ? freshSeed(items) : 0, prevSeed: null, forwardSeed: null };
}

const MIN_SLIDE_MS = 3000;

/**
 * Hard ceiling on any single video. Without it a stream that never fires
 * `ended` - a truncated file, a codec the TV cannot decode - parks the frame
 * on one item forever.
 */
const MAX_VIDEO_MS = 10 * 60 * 1000;

/**
 * A few broken items in a row are skipped at once. Past that, everything is
 * probably failing (offline, or Google throttling the network), so wait
 * longer between tries instead of racing through the whole album.
 */
const FAST_SKIPS = 3;
const FIRST_RETRY_MS = 5000;
const MAX_RETRY_MS = 60 * 1000;

export function useSlideshow({
  items,
  durationSeconds,
  transitionEffect,
  order = 'album',
  albumKey,
}: UseSlideshowOptions) {
  const [nav, setNav] = useState<Nav>(() => startNav(items, order, albumKey));
  const sequence = useMemo(() => buildSequence(items, order, nav.seed), [items, order, nav.seed]);
  /** Position in this pass, which is also what the on-screen counter shows. */
  const currentIndex = Math.min(nav.pos, Math.max(0, sequence.length - 1));
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeRandomEffect, setActiveRandomEffect] = useState<Exclude<TransitionType, 'random'>>('ken-burns');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const failuresRef = useRef(0);
  const failedIndexRef = useRef<number | null>(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const currentItem: MediaItem | undefined = items[sequence[currentIndex]];
  const isVideo = currentItem ? isVideoItem(currentItem) : false;

  // When the album reloads (new photos, fewer photos), stay on the same item
  // rather than whatever now sits at its old position.
  const currentIdRef = useRef(currentItem?.id);
  const lastItemsRef = useRef(items);
  useEffect(() => {
    if (lastItemsRef.current === items) return;
    lastItemsRef.current = items;
    const found = sequence.findIndex((i) => items[i]?.id === currentIdRef.current);
    setNav((n) => ({ ...n, pos: found >= 0 ? found : n.pos < sequence.length ? n.pos : 0 }));
  }, [items, sequence]);
  // Declared after the effect above, so that effect still sees the previous item.
  useEffect(() => {
    currentIdRef.current = currentItem?.id;
  });

  // Remember where this album is, so switching the TV off loses nothing.
  useEffect(() => {
    if (!albumKey || !currentItem) return;
    saveProgress(albumKey, { order, seed: nav.seed, prevSeed: nav.prevSeed, itemId: currentItem.id });
  }, [albumKey, order, nav.seed, nav.prevSeed, currentItem]);

  const selectNextEffect = useCallback(() => {
    if (transitionEffect === 'random') {
      setActiveRandomEffect(getRandomTransition());
    }
  }, [transitionEffect]);

  const nextSlide = useCallback(() => {
    const n = sequence.length;
    if (n === 0) return;
    selectNextEffect();
    setNav((cur) => {
      const pos = Math.min(cur.pos, n - 1);
      if (pos + 1 < n) return { ...cur, pos: pos + 1 };
      // End of a pass. Every order loops; a shuffle starts a fresh pass, or
      // returns to the one Back stepped out of.
      if (order !== 'shuffle') return { ...cur, pos: 0 };
      const seed = cur.forwardSeed ?? freshSeed(items, items[sequence[n - 1]]?.id);
      return { pos: 0, seed, prevSeed: cur.seed, forwardSeed: null };
    });
  }, [sequence, items, order, selectNextEffect]);

  /** Back always steps through what was actually shown, even across passes. */
  const prevSlide = useCallback(() => {
    const n = sequence.length;
    if (n === 0) return;
    selectNextEffect();
    setNav((cur) => {
      const pos = Math.min(cur.pos, n - 1);
      if (pos > 0) return { ...cur, pos: pos - 1 };
      if (order === 'shuffle' && cur.prevSeed !== null) {
        return { pos: n - 1, seed: cur.prevSeed, prevSeed: null, forwardSeed: cur.seed };
      }
      return { ...cur, pos: n - 1 };
    });
  }, [sequence.length, order, selectNextEffect]);

  const setCurrentIndex = useCallback((pos: number) => setNav((cur) => ({ ...cur, pos })), []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleVideoEnded = useCallback(() => {
    // When a video completes playing in full, advance to next slide!
    nextSlide();
  }, [nextSlide]);

  /**
   * Any media failure - a decode error, an expired Google URL, a blocked
   * autoplay - must move the slideshow on rather than stall it.
   */
  const handleMediaError = useCallback(() => {
    if (items.length <= 1) return;
    // A video can report the same failure several ways; count it once.
    if (failedIndexRef.current === currentIndexRef.current) return;
    failedIndexRef.current = currentIndexRef.current;

    failuresRef.current += 1;
    if (failuresRef.current <= FAST_SKIPS) {
      nextSlide();
      return;
    }
    // The auto-advance timer below picks this delay up.
    const backoff = FIRST_RETRY_MS * 2 ** (failuresRef.current - FAST_SKIPS - 1);
    setRetryDelayMs(Math.min(MAX_RETRY_MS, backoff));
  }, [items.length, nextSlide]);

  /** An item showed fine, so whatever was failing has recovered. */
  const handleMediaLoaded = useCallback(() => {
    failuresRef.current = 0;
    failedIndexRef.current = null;
    setRetryDelayMs(0);
  }, []);

  // Warm the next photo so the transition does not show a half-loaded image.
  useEffect(() => {
    if (items.length <= 1) return;
    const nextItem = items[sequence[(currentIndex + 1) % sequence.length]];
    if (nextItem && !isVideoItem(nextItem)) {
      preloadImage(nextItem.baseUrl);
    }
  }, [items, sequence, currentIndex]);

  // Auto-advance. Photos use the configured duration; videos only get the
  // safety ceiling, because normal advancing happens on `ended`.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isPlaying || items.length <= 1) {
      return;
    }

    const delayMs =
      retryDelayMs > 0
        ? retryDelayMs
        : isVideo
          ? MAX_VIDEO_MS
          : Math.max(MIN_SLIDE_MS, durationSeconds * 1000);
    timerRef.current = setTimeout(() => {
      nextSlide();
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, items.length, isVideo, durationSeconds, nextSlide, currentIndex, retryDelayMs]);

  return {
    currentIndex,
    currentItem,
    isPlaying,
    isVideo,
    activeRandomEffect,
    nextSlide,
    prevSlide,
    togglePlay,
    setIsPlaying,
    handleVideoEnded,
    handleMediaError,
    handleMediaLoaded,
    /** True while photos keep failing and the slideshow is waiting to retry. */
    isRetrying: retryDelayMs > 0,
    setCurrentIndex,
  };
}
