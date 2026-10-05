import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaItem, TransitionType } from '../types';
import { getRandomTransition } from '../utils/transitions';
import { isVideoItem, preloadImage } from '../utils/mediaUrls';

interface UseSlideshowOptions {
  items: MediaItem[];
  durationSeconds: number;
  transitionEffect: TransitionType;
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
}: UseSlideshowOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeRandomEffect, setActiveRandomEffect] = useState<Exclude<TransitionType, 'random'>>('ken-burns');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const failuresRef = useRef(0);
  const failedIndexRef = useRef<number | null>(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const currentItem: MediaItem | undefined = items[currentIndex];
  const isVideo = currentItem ? isVideoItem(currentItem) : false;

  // Keep the index inside range if the album is reloaded with fewer items.
  useEffect(() => {
    if (items.length > 0 && currentIndex >= items.length) {
      setCurrentIndex(0);
    }
  }, [items.length, currentIndex]);

  const selectNextEffect = useCallback(() => {
    if (transitionEffect === 'random') {
      setActiveRandomEffect(getRandomTransition());
    }
  }, [transitionEffect]);

  const nextSlide = useCallback(() => {
    if (items.length === 0) return;
    selectNextEffect();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length, selectNextEffect]);

  const prevSlide = useCallback(() => {
    if (items.length === 0) return;
    selectNextEffect();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length, selectNextEffect]);

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
    const nextItem = items[(currentIndex + 1) % items.length];
    if (nextItem && !isVideoItem(nextItem)) {
      preloadImage(nextItem.baseUrl);
    }
  }, [items, currentIndex]);

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
