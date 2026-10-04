import React, { useEffect, useRef } from 'react';
import { Settings, Play, Images, X } from 'lucide-react';
import { AmbientStatus } from '../api/ambient';
import { RecentAlbum } from '../utils/recentAlbums';
import { useSpatialNavigation } from '../hooks/useSpatialNavigation';
import { PhotosPanel } from './PhotosPanel';

interface HomeScreenProps {
  recent: RecentAlbum[];
  demoCover: string;
  demoCount: number;
  ambientStatus: AmbientStatus;
  googleCount: number;
  googleCover?: string;
  notice?: string | null;
  onDismissNotice: () => void;
  onPlayDemo: () => void;
  onPlayGoogle: () => void;
  onPlayRecent: (entry: RecentAlbum) => void;
  onConnect: () => Promise<unknown>;
  onOpenSettings: () => void;
}

export const TAGLINE =
  'Turns any TV into a living photo frame, with your videos, the time and the weather.';

const RecentCard: React.FC<{ entry: RecentAlbum; cover?: string; onPlay: () => void }> = ({
  entry,
  cover,
  onPlay,
}) => (
  <button
    data-nav
    data-recent
    onClick={onPlay}
    aria-label={`Play ${entry.title}, ${entry.count} items`}
    className="group rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 text-left tv-focus-target"
  >
    <div className="aspect-[16/9] bg-slate-800 relative">
      {cover ? (
        <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600">
          <Images className="w-10 h-10" />
        </div>
      )}
    </div>
    <div className="px-4 py-3 flex items-baseline gap-2 min-w-0">
      <span className="font-semibold text-white truncate">{entry.title}</span>
      <span className="text-sm text-slate-400 shrink-0">{entry.count}</span>
    </div>
  </button>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({
  recent,
  demoCover,
  demoCount,
  ambientStatus,
  googleCount,
  googleCover,
  notice,
  onDismissNotice,
  onPlayDemo,
  onPlayGoogle,
  onPlayRecent,
  onConnect,
  onOpenSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useSpatialNavigation(containerRef);

  // One press of OK should resume: start on the most recent album, or the
  // demo on a first visit. Never pull focus out of an open dialog.
  useEffect(() => {
    if (document.querySelector('[role="dialog"]')) return;
    const node = containerRef.current;
    const target =
      node?.querySelector<HTMLElement>('[data-recent]') ??
      node?.querySelector<HTMLElement>('[data-demo]');
    target?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-slate-950 text-slate-100 font-sans select-none overflow-y-auto"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-8 lg:py-12 flex flex-col gap-10">
        <div className="flex justify-end -mb-6">
          <button
            data-nav
            onClick={onOpenSettings}
            aria-label="Settings"
            className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 tv-focus-target"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <header className="text-center">
          <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-white">Your Photo Frame</h1>
          <p className="mt-3 text-base lg:text-xl text-slate-400">{TAGLINE}</p>
        </header>

        {notice && (
          <div
            role="alert"
            className="flex items-start gap-3 max-w-3xl mx-auto w-full p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-sm text-red-100"
          >
            <span className="flex-1">{notice}</span>
            <button onClick={onDismissNotice} aria-label="Dismiss" className="text-red-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {recent.length > 0 && (
          <section aria-labelledby="continue-heading">
            <h2 id="continue-heading" className="text-sm font-semibold text-slate-400 mb-3">
              Continue
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
              {recent.map((entry) => (
                <RecentCard
                  key={entry.key}
                  entry={entry}
                  cover={entry.kind === 'google' ? googleCover : entry.cover}
                  onPlay={() => onPlayRecent(entry)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          <button
            data-nav
            data-demo
            onClick={onPlayDemo}
            aria-label={`Try the demo, ${demoCount} photos and videos`}
            className="group relative min-h-[260px] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 tv-focus-target text-left"
          >
            <img src={demoCover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xl">
                <Play className="w-8 h-8 fill-current ml-1" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950/95 to-transparent">
              <p className="text-xl lg:text-2xl font-bold text-white">Try the demo</p>
            </div>
          </button>

          <PhotosPanel
            status={ambientStatus}
            itemCount={googleCount}
            cover={googleCover}
            onConnect={onConnect}
            onPlay={onPlayGoogle}
          />
        </section>
      </div>
    </div>
  );
};
