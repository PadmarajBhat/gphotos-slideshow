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
  Volume2,
  VolumeX,
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
  soundOn?: boolean;
  onToggleSound?: () => void;
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
  soundOn = true,
  onToggleSound,
  currentIndex,
  totalItems,
}) => {
  const canFullScreen = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);

  return (
    <div
      role="toolbar"
      aria-label="Slideshow Controls"
      className="ambient-glass rounded-full px-2 py-1.5 sm:px-5 sm:py-2.5 flex items-center gap-1 sm:gap-4 transition-all duration-300 shadow-2xl pointer-events-auto"
    >
      <button
        onClick={onBack}
        title="Back to Albums (Escape / Back)"
        className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
        aria-label="Back to Albums"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="hidden sm:block h-5 w-px bg-white/20" />

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

      <div className="hidden sm:block h-5 w-px bg-white/20" />

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

      {onToggleSound && (
        <button
          onClick={onToggleSound}
          title="Video sound (M key)"
          className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
          aria-label={soundOn ? 'Turn video sound off' : 'Turn video sound on'}
        >
          {soundOn ? <Volume2 className="w-5 h-5 text-amber-300" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
        </button>
      )}

      {/* iPhones have no page fullscreen; a button that does nothing just confuses. */}
      {canFullScreen && (
        <button
          onClick={onToggleFullScreen}
          title="Toggle Fullscreen (F key)"
          className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition tv-focus-target"
          aria-label="Toggle Fullscreen"
        >
          {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
};
