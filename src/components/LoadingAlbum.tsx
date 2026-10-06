import React, { useEffect, useState } from 'react';

/**
 * Shown while an album is fetched. Large albums take a while, so after a few
 * seconds it says how long to expect instead of leaving a bare spinner.
 */
export function loadingHint(seconds: number): string {
  if (seconds < 5) return 'This usually takes a few seconds.';
  if (seconds < 15) return 'Large albums take longer: about 5 seconds for every 700 photos and videos.';
  return 'Still loading. An album with thousands of items can take up to a minute.';
}

export const LoadingAlbum: React.FC = () => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <div className="w-14 h-14 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-xl font-bold text-white">
        Loading album… {seconds > 0 && <span className="text-slate-400 font-semibold">{seconds}s</span>}
      </p>
      <p className="text-sm text-slate-400 max-w-sm">{loadingHint(seconds)}</p>
    </div>
  );
};
