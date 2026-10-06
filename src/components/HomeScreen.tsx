import React, { useEffect, useRef } from 'react';
import { Settings, Play, Images, X } from 'lucide-react';
import { RecentAlbum } from '../utils/recentAlbums';
import { useSpatialNavigation } from '../hooks/useSpatialNavigation';

interface HomeScreenProps {
  recent: RecentAlbum[];
  demoCover: string;
  demoCount: number;
  /** Right-hand panel: the send-from-phone QR, or Google Photos pairing. */
  rightPanel: React.ReactNode;
  googleCover?: string;
  notice?: string | null;
  onDismissNotice: () => void;
  onPlayDemo: () => void;
  onPlayRecent: (entry: RecentAlbum) => void;
  onOpenSettings: () => void;
}

export const TAGLINE =
  'Turns any TV into a living photo frame, with your videos, the time and the weather.';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "627 photos · 60 videos", or just the total for entries saved before the breakdown existed. */
export function describeContents(entry: RecentAlbum): string {
  if (entry.photos === undefined || entry.videos === undefined) return plural(entry.count, 'item');
  const parts = [];
  if (entry.photos > 0) parts.push(plural(entry.photos, 'photo'));
  if (entry.videos > 0) parts.push(plural(entry.videos, 'video'));
  return parts.join(' · ') || plural(entry.count, 'item');
}

const RecentCard: React.FC<{ entry: RecentAlbum; cover?: string; onPlay: () => void }> = ({
  entry,
  cover,
  onPlay,
}) => (
  <button
    data-nav
    data-recent
    onClick={onPlay}
    aria-label={`Play ${entry.title}, ${describeContents(entry)}`}
    // A compact row on phones, so three of them don't push everything else off screen.
    className="group flex sm:flex-col items-center sm:items-stretch rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 text-left tv-focus-target"
  >
    <div className="w-28 sm:w-auto shrink-0 aspect-[16/9] [@media(max-height:600px)]:aspect-[21/9] bg-slate-800 relative">
      {cover ? (
        <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600">
          <Images className="w-10 h-10" />
        </div>
      )}
    </div>
    <div className="px-4 py-2.5 flex flex-col min-w-0">
      <span className="font-semibold text-white truncate">{entry.title}</span>
      <span className="text-sm text-slate-400 truncate">{describeContents(entry)}</span>
    </div>
  </button>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({
  recent,
  demoCover,
  demoCount,
  rightPanel,
  googleCover,
  notice,
  onDismissNotice,
  onPlayDemo,
  onPlayRecent,
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
    // Scrolls inside a viewport-height box: the page itself is locked so the
    // slideshow can't scroll. On a TV-sized screen everything fits instead.
    <div
      ref={containerRef}
      className="h-viewport bg-slate-950 text-slate-100 font-sans select-none overflow-y-auto"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-8 tv:py-6 lg:py-10 flex flex-col gap-10 tv:gap-6 lg:gap-8 tv:h-full">
        <div className="flex justify-end -mb-6 shrink-0">
          <button
            data-nav
            onClick={onOpenSettings}
            aria-label="Settings"
            className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 tv-focus-target"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <header className="text-center shrink-0">
          <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-white">Your Photo Frame</h1>
          <p className="mt-3 text-base lg:text-xl text-slate-400">{TAGLINE}</p>
        </header>

        {notice && (
          <div
            role="alert"
            className="shrink-0 flex items-start gap-3 max-w-3xl mx-auto w-full p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-sm text-red-100"
          >
            <span className="flex-1">{notice}</span>
            <button onClick={onDismissNotice} aria-label="Dismiss" className="text-red-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Continue sits above the demo in the left column rather than above
            both columns, so however many albums it holds, the QR on the right
            keeps its full height. */}
        <section className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6 lg:gap-8 tv:flex-1 tv:min-h-0 tv:grid-rows-[minmax(0,1fr)]">
          <div className="flex flex-col gap-6 lg:gap-8 min-h-0">
            {recent.length > 0 && (
              <section aria-labelledby="continue-heading" className="shrink-0">
                <h2 id="continue-heading" className="text-sm font-semibold text-slate-400 mb-3">
                  Continue
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-5">
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

            <button
              data-nav
              data-demo
              onClick={onPlayDemo}
              aria-label={`Try the demo, ${demoCount} photos and videos`}
              className="group relative min-h-[220px] tv:min-h-[100px] tv:flex-1 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 tv-focus-target text-left"
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
          </div>

          {rightPanel}
        </section>

        {/* Google's OAuth verification requires the homepage to link these. */}
        <footer className="flex justify-center gap-4 text-xs text-slate-500 -mt-4 tv:-mt-2 shrink-0">
          <a href={`${import.meta.env.BASE_URL}privacy.html`} className="hover:text-slate-300">
            Privacy
          </a>
          <span aria-hidden="true">·</span>
          <a href={`${import.meta.env.BASE_URL}terms.html`} className="hover:text-slate-300">
            Terms
          </a>
        </footer>
      </div>
    </div>
  );
};
