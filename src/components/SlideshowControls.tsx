import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SlideshowControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onToggleFullScreen: () => void;
  isFullScreen: boolean;
  showHud: boolean;
  onToggleHud: () => void;
  currentIndex: number;
  totalItems: number;
}

export const SlideshowControls: React.FC<SlideshowControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
  onBack,
  onToggleFullScreen,
  isFullScreen,
  showHud,
  onToggleHud,
  currentIndex,
  totalItems,
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Slideshow Controls"
      className="ambient-glass rounded-full px-5 py-2.5 flex items-center gap-4 transition-all duration-300 shadow-2xl pointer-events-auto"
    >
      <button
        onClick={onBack}
        title="Back to Albums (Escape / Back)"
        className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
        aria-label="Back to Albums"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="h-5 w-px bg-white/20" />

      <button
        onClick={onPrev}
        title="Previous Photo (Left Arrow)"
        className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
        aria-label="Previous Slide"
      >
        <SkipBack className="w-5 h-5" />
      </button>

      <button
        onClick={onTogglePlay}
        title="Play / Pause (Space / OK)"
        className="p-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-full transition shadow-lg tv-focus-target"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      <button
        onClick={onNext}
        title="Next Photo (Right Arrow)"
        className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
        aria-label="Next Slide"
      >
        <SkipForward className="w-5 h-5" />
      </button>

      <div className="h-5 w-px bg-white/20" />

      <span className="text-xs font-mono text-slate-300 px-1">
        {currentIndex + 1} / {totalItems}
      </span>

      <button
        onClick={onToggleHud}
        title="Toggle Ambient Info HUD (H key)"
        className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
        aria-label="Toggle HUD"
      >
        {showHud ? <Eye className="w-5 h-5 text-amber-300" /> : <EyeOff className="w-5 h-5 text-slate-400" />}
      </button>

      <button
        onClick={onToggleFullScreen}
        title="Toggle Fullscreen (F key)"
        className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
        aria-label="Toggle Fullscreen"
      >
        {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>
    </div>
  );
};
