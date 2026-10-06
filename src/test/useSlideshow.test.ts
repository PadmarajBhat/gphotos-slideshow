import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlideshow } from '../hooks/useSlideshow';
import { MediaItem } from '../types';

const mockItems: MediaItem[] = [
  {
    id: 'item-1',
    description: 'First Image',
    filename: 'image1.jpg',
    baseUrl: 'https://example.com/img1.jpg',
    mimeType: 'image/jpeg',
    mediaMetadata: {
      creationTime: '2025-01-01T12:00:00Z',
      width: '1920',
      height: '1080',
    },
  },
  {
    id: 'item-2-video',
    description: 'Sample Video Item',
    filename: 'video.mp4',
    baseUrl: 'https://example.com/vid.mp4',
    videoUrl: 'https://example.com/vid.mp4',
    mimeType: 'video/mp4',
    mediaMetadata: {
      creationTime: '2025-01-02T12:00:00Z',
      width: '1920',
      height: '1080',
      video: { fps: 30, status: 'READY' },
    },
  },
  {
    id: 'item-3',
    description: 'Third Image',
    filename: 'image3.jpg',
    baseUrl: 'https://example.com/img3.jpg',
    mimeType: 'image/jpeg',
    mediaMetadata: {
      creationTime: '2025-01-03T12:00:00Z',
      width: '1920',
      height: '1080',
    },
  },
];

describe('useSlideshow Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with the first item and active playing state', () => {
    const { result } = renderHook(() =>
      useSlideshow({
        items: mockItems,
        durationSeconds: 10,
        transitionEffect: 'random',
      })
    );

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentItem?.id).toBe('item-1');
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.isVideo).toBe(false);
  });

  it('advances to next slide on timer interval for photos', () => {
    const { result } = renderHook(() =>
      useSlideshow({
        items: mockItems,
        durationSeconds: 5,
        transitionEffect: 'crossfade',
      })
    );

    expect(result.current.currentIndex).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isVideo).toBe(true);
  });

  it('pauses timer automatically when active media is a video', () => {
    const { result } = renderHook(() =>
      useSlideshow({
        items: mockItems,
        durationSeconds: 5,
        transitionEffect: 'crossfade',
      })
    );

    // Advance to item-2 (which is video)
    act(() => {
      result.current.nextSlide();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isVideo).toBe(true);

    // Even if timer elapses, video must NOT advance automatically
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(result.current.currentIndex).toBe(1);

    // Only on video ended event, advances to next slide!
    act(() => {
      result.current.handleVideoEnded();
    });

    expect(result.current.currentIndex).toBe(2);
    expect(result.current.isVideo).toBe(false);
  });

  it('loops back to first item when reaching end of album', () => {
    const { result } = renderHook(() =>
      useSlideshow({
        items: mockItems,
        durationSeconds: 5,
        transitionEffect: 'ken-burns',
      })
    );

    act(() => {
      result.current.setCurrentIndex(2);
    });
    expect(result.current.currentIndex).toBe(2);

    act(() => {
      result.current.nextSlide();
    });
    expect(result.current.currentIndex).toBe(0);
  });

  it('toggles pause and play state', () => {
    const { result } = renderHook(() =>
      useSlideshow({
        items: mockItems,
        durationSeconds: 5,
        transitionEffect: 'random',
      })
    );

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.togglePlay();
    });
    expect(result.current.isPlaying).toBe(false);

    act(() => {
      result.current.togglePlay();
    });
    expect(result.current.isPlaying).toBe(true);
  });

  it('does not advance while paused', () => {
    const { result } = renderHook(() =>
      useSlideshow({ items: mockItems, durationSeconds: 5, transitionEffect: 'crossfade' })
    );

    act(() => {
      result.current.togglePlay();
    });
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(result.current.currentIndex).toBe(0);
  });

  it('skips past media that fails to load instead of stalling', () => {
    const { result } = renderHook(() =>
      useSlideshow({ items: mockItems, durationSeconds: 5, transitionEffect: 'crossfade' })
    );

    act(() => {
      result.current.handleMediaError();
    });

    expect(result.current.currentIndex).toBe(1);
  });

  it('gives a stuck video a hard ceiling so the frame never freezes forever', () => {
    const { result } = renderHook(() =>
      useSlideshow({ items: mockItems, durationSeconds: 5, transitionEffect: 'crossfade' })
    );

    act(() => {
      result.current.nextSlide();
    });
    expect(result.current.isVideo).toBe(true);

    // Well past any real clip, and past the photo duration, but `ended` never fired.
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    });

    expect(result.current.currentIndex).toBe(2);
  });

  it('stays on a single-item album rather than looping a media error', () => {
    const { result } = renderHook(() =>
      useSlideshow({ items: [mockItems[0]], durationSeconds: 5, transitionEffect: 'crossfade' })
    );

    act(() => {
      result.current.handleMediaError();
    });

    expect(result.current.currentIndex).toBe(0);
  });

  describe('when everything fails to load', () => {
    const photos: MediaItem[] = Array.from({ length: 10 }, (_, i) => ({
      ...mockItems[0],
      id: `photo-${i}`,
      baseUrl: `https://example.com/p${i}.jpg`,
    }));
    const failCurrent = (result: { current: ReturnType<typeof useSlideshow> }) =>
      act(() => result.current.handleMediaError());

    it('slows down instead of racing through the album', () => {
      const { result } = renderHook(() =>
        useSlideshow({ items: photos, durationSeconds: 5, transitionEffect: 'crossfade' })
      );

      for (let i = 0; i < 4; i += 1) failCurrent(result);
      // Three quick skips, then the fourth failure waits.
      expect(result.current.currentIndex).toBe(3);
      expect(result.current.isRetrying).toBe(true);

      act(() => vi.advanceTimersByTime(4900));
      expect(result.current.currentIndex).toBe(3);
      act(() => vi.advanceTimersByTime(200));
      expect(result.current.currentIndex).toBe(4);

      // The next failure waits twice as long.
      failCurrent(result);
      act(() => vi.advanceTimersByTime(9900));
      expect(result.current.currentIndex).toBe(4);
      act(() => vi.advanceTimersByTime(200));
      expect(result.current.currentIndex).toBe(5);
    });

    it('counts several error events from one item as one failure', () => {
      const { result } = renderHook(() =>
        useSlideshow({ items: photos, durationSeconds: 5, transitionEffect: 'crossfade' })
      );
      act(() => {
        result.current.handleMediaError();
        result.current.handleMediaError();
      });
      expect(result.current.currentIndex).toBe(1);
    });

    it('goes back to normal as soon as a photo loads', () => {
      const { result } = renderHook(() =>
        useSlideshow({ items: photos, durationSeconds: 5, transitionEffect: 'crossfade' })
      );
      for (let i = 0; i < 4; i += 1) failCurrent(result);
      act(() => vi.advanceTimersByTime(5000));

      act(() => result.current.handleMediaLoaded());
      expect(result.current.isRetrying).toBe(false);

      // A later failure is a quick skip again.
      failCurrent(result);
      expect(result.current.currentIndex).toBe(5);
    });
  });

  describe('play order, resuming and Back', () => {
    const dated: MediaItem[] = Array.from({ length: 8 }, (_, i) => ({
      ...mockItems[0],
      id: `d${i}`,
      baseUrl: `https://example.com/d${i}.jpg`,
      mediaMetadata: { ...mockItems[0].mediaMetadata, creationTime: `202${i}-01-01T00:00:00Z` },
    }));
    type Opts = Partial<Parameters<typeof useSlideshow>[0]>;
    const show = (opts: Opts = {}) =>
      renderHook((props: Opts) =>
        useSlideshow({ items: dated, durationSeconds: 5, transitionEffect: 'crossfade', ...opts, ...props })
      );
    const id = (r: { current: ReturnType<typeof useSlideshow> }) => r.current.currentItem?.id;
    const next = (r: { current: ReturnType<typeof useSlideshow> }) => act(() => r.current.nextSlide());
    const prev = (r: { current: ReturnType<typeof useSlideshow> }) => act(() => r.current.prevSlide());

    it('starts with the newest, or the oldest', () => {
      expect(id(show({ order: 'newest' }).result)).toBe('d7');
      expect(id(show({ order: 'oldest' }).result)).toBe('d0');
    });

    it('shuffles through every item once, then reshuffles and keeps going', () => {
      const { result } = show({ order: 'shuffle' });
      const firstPass: string[] = [];
      for (let i = 0; i < dated.length; i += 1) {
        firstPass.push(id(result)!);
        next(result);
      }
      expect(new Set(firstPass).size).toBe(dated.length);
      expect(result.current.currentIndex).toBe(0);
      expect(id(result)).not.toBe(firstPass[firstPass.length - 1]);
    });

    it('steps Back into the previous shuffled pass, then forward to where it was', () => {
      const { result } = show({ order: 'shuffle' });
      const shown: string[] = [];
      for (let i = 0; i < dated.length; i += 1) {
        shown.push(id(result)!);
        next(result);
      }
      const startOfNewPass = id(result);

      prev(result);
      expect(id(result)).toBe(shown[shown.length - 1]);
      prev(result);
      expect(id(result)).toBe(shown[shown.length - 2]);

      next(result);
      next(result);
      expect(id(result)).toBe(startOfNewPass);
    });

    it('carries on from the same photo after the TV is switched off', () => {
      const first = show({ order: 'shuffle', albumKey: 'shared:k|all' });
      next(first.result);
      next(first.result);
      next(first.result);
      const onScreen = id(first.result);
      const upNext: string[] = [];
      next(first.result);
      upNext.push(id(first.result)!);
      prev(first.result);
      first.unmount();

      const again = show({ order: 'shuffle', albumKey: 'shared:k|all' });
      expect(id(again.result)).toBe(onScreen);
      // Same shuffled order as before, not a new one.
      next(again.result);
      expect(id(again.result)).toBe(upNext[0]);
    });

    it('resumes in album order too, and starts fresh when the order is changed', () => {
      const first = show({ order: 'album', albumKey: 'demo|all' });
      next(first.result);
      next(first.result);
      first.unmount();
      expect(id(show({ order: 'album', albumKey: 'demo|all' }).result)).toBe('d2');
      expect(id(show({ order: 'newest', albumKey: 'demo|all' }).result)).toBe('d7');
    });

    it('stays on the same photo when the album reloads with more photos', () => {
      const { result, rerender } = show({ order: 'newest' });
      next(result);
      expect(id(result)).toBe('d6');
      const added = { ...dated[0], id: 'brand-new', mediaMetadata: { ...dated[0].mediaMetadata, creationTime: '2030-01-01T00:00:00Z' } };
      rerender({ items: [...dated, added] });
      expect(id(result)).toBe('d6');
    });
  });

  it('recovers when the album is reloaded with fewer items', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useSlideshow({ items, durationSeconds: 5, transitionEffect: 'crossfade' }),
      { initialProps: { items: mockItems } }
    );

    act(() => {
      result.current.setCurrentIndex(2);
    });
    rerender({ items: [mockItems[0]] });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentItem?.id).toBe('item-1');
  });
});
