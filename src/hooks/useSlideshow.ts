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

export function useSlideshow({
  items,
  durationSeconds,
  transitionEffect,
}: UseSlideshowOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeRandomEffect, setActiveRandomEffect] = useState<Exclude<TransitionType, 'random'>>('ken-burns');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    nextSlide();
  }, [items.length, nextSlide]);

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

    const delayMs = isVideo ? MAX_VIDEO_MS : Math.max(MIN_SLIDE_MS, durationSeconds * 1000);
    timerRef.current = setTimeout(() => {
      nextSlide();
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, items.length, isVideo, durationSeconds, nextSlide, currentIndex]);

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
    setCurrentIndex,
  };
}
