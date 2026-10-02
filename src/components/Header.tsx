import React from 'react';
import { AmbientPhase } from '../api/ambient';
import { Tv, Settings, Sparkles, Images, Shield, Link2 } from 'lucide-react';

interface HeaderProps {
  ambientPhase: AmbientPhase;
  isDemoActive: boolean;
  onOpenGooglePhotos: () => void;
  onOpenSharedLink: () => void;
  onStartDemo: () => void;
  onOpenSettings: () => void;
}

function describeAmbient(phase: AmbientPhase): { label: string; tone: string } {
  switch (phase) {
    case 'ready':
      return { label: 'Google Photos', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'pairing':
    case 'awaiting_sources':
      return { label: 'Finish Setup', tone: 'bg-amber-400 text-slate-950 border-amber-400' };
    case 'error':
      return { label: 'Google Photos', tone: 'bg-red-950/50 text-red-300 border-red-500/40' };
    default:
      return { label: 'Use My Photos', tone: 'bg-amber-400 text-slate-950 border-amber-400' };
  }
}

export const Header: React.FC<HeaderProps> = ({
  ambientPhase,
  isDemoActive,
  onOpenGooglePhotos,
  onOpenSharedLink,
  onStartDemo,
  onOpenSettings,
}) => {
  const ambient = describeAmbient(ambientPhase);

  return (
    <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 lg:px-12 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
      {/* Brand logo & title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
          <Tv className="w-6 h-6 stroke-[2.2]" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>LuminaFrame</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
              TV Ambient
            </span>
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            Google Photos Ambient Slideshow for Smart TVs &amp; Screens
          </p>
        </div>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-3">
        {!isDemoActive && (
          <button
            onClick={onStartDemo}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-sm rounded-xl border border-slate-700 transition flex items-center gap-2 tv-focus-target cursor-pointer"
            title="Experience the slideshow immediately with curated sample photos & videos"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Try Demo</span>
          </button>
        )}

        <button
          onClick={onOpenSharedLink}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition flex items-center gap-2 tv-focus-target cursor-pointer"
          title="Play a Google Photos shared album link"
        >
          <Link2 className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Shared Link</span>
        </button>

        <button
          onClick={onOpenGooglePhotos}
          className={`px-4 py-2 font-bold text-sm rounded-xl border transition flex items-center gap-2 shadow-md tv-focus-target cursor-pointer ${ambient.tone}`}
        >
          <Images className="w-4 h-4" />
          <span>{ambient.label}</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition tv-focus-target cursor-pointer"
          title="Open Settings (Slide duration, transitions, weather unit)"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div
          className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20"
          title="No images, tokens, or personal data are saved by this app"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Private &amp; Safe</span>
        </div>
      </div>
    </header>
  );
};
