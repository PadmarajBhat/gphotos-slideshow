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
