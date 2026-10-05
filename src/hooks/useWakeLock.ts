import { useEffect } from 'react';

/**
 * Keeps the screen on while mounted, so a phone or tablet left on a stand
 * doesn't dim and lock mid-slideshow. TVs mostly ignore this, which is fine.
 */
export function useWakeLock(): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          next.release().catch(() => {});
        } else {
          sentinel = next;
        }
      } catch {
        // Refused (battery saver, no permission). The slideshow still works.
      }
    };

    // The browser drops the lock whenever the tab is hidden; take it back.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, []);
}
