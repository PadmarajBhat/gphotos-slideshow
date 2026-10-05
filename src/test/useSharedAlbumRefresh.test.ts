import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../api/sharedAlbum', () => ({ fetchSharedAlbum: vi.fn() }));

import { fetchSharedAlbum } from '../api/sharedAlbum';
import { SHARED_REFRESH_MS, useSharedAlbumRefresh } from '../hooks/useSharedAlbumRefresh';

const ALBUM = {
  album: { id: 'a', title: 'Krishna', coverPhotoBaseUrl: 'c', mediaItemsCount: '1', isDemo: false },
  items: [{ id: '1', baseUrl: 'https://lh3.googleusercontent.com/pw/x=w1', filename: 'x' }],
  complete: true,
};

describe('useSharedAlbumRefresh', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reloads the playing album every few hours and hands over the fresh list', async () => {
    vi.mocked(fetchSharedAlbum).mockResolvedValue(ALBUM as never);
    const onRefreshed = vi.fn();
    renderHook(() => useSharedAlbumRefresh('https://photos.app.goo.gl/abc', onRefreshed));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHARED_REFRESH_MS - 1000);
    });
    expect(fetchSharedAlbum).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchSharedAlbum).toHaveBeenCalledWith('https://photos.app.goo.gl/abc');
    expect(onRefreshed).toHaveBeenCalledWith(ALBUM);
  });

  it('keeps playing what it has when a reload fails', async () => {
    vi.mocked(fetchSharedAlbum).mockRejectedValue(new Error('offline'));
    const onRefreshed = vi.fn();
    renderHook(() => useSharedAlbumRefresh('https://photos.app.goo.gl/abc', onRefreshed));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHARED_REFRESH_MS);
    });
    expect(onRefreshed).not.toHaveBeenCalled();
  });

  it('does nothing when no shared album is playing, and stops when it ends', async () => {
    const { rerender } = renderHook(({ url }) => useSharedAlbumRefresh(url, vi.fn()), {
      initialProps: { url: null as string | null },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHARED_REFRESH_MS * 2);
    });
    expect(fetchSharedAlbum).not.toHaveBeenCalled();

    rerender({ url: 'https://photos.app.goo.gl/abc' });
    rerender({ url: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SHARED_REFRESH_MS * 2);
    });
    expect(fetchSharedAlbum).not.toHaveBeenCalled();
  });
});
