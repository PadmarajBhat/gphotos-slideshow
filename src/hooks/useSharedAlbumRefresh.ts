import { useEffect, useRef } from 'react';
import { fetchSharedAlbum } from '../api/sharedAlbum';

/**
 * Google doesn't say how long a shared album's photo links last, and a frame
 * can run for days. Reloading every few hours keeps the links fresh and picks
 * up photos added to the album since.
 */
export const SHARED_REFRESH_MS = 6 * 60 * 60 * 1000;

type SharedAlbum = Awaited<ReturnType<typeof fetchSharedAlbum>>;

/** While `url` is playing, reload it every SHARED_REFRESH_MS. Failures keep the current list. */
export function useSharedAlbumRefresh(url: string | null, onRefreshed: (album: SharedAlbum) => void): void {
  const callbackRef = useRef(onRefreshed);
  callbackRef.current = onRefreshed;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetchSharedAlbum(url)
        .then((album) => {
          if (!cancelled) callbackRef.current(album);
        })
        .catch(() => {
          // Offline or Google hiccup: carry on with the list we have.
        });
    }, SHARED_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [url]);
}
