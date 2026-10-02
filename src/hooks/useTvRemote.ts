import { useEffect } from 'react';

interface UseTvRemoteOptions {
  onNext?: () => void;
  onPrev?: () => void;
  onTogglePlay?: () => void;
  onBack?: () => void;
  onToggleFullScreen?: () => void;
  onToggleHud?: () => void;
  enabled?: boolean;
}

export function useTvRemote({
  onNext,
  onPrev,
  onTogglePlay,
  onBack,
  onToggleFullScreen,
  onToggleHud,
  enabled = true,
}: UseTvRemoteOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in input elements or textareas
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'MediaTrackNext':
          e.preventDefault();
          onNext?.();
          break;

        case 'ArrowLeft':
        case 'MediaTrackPrevious':
          e.preventDefault();
          onPrev?.();
          break;

        case ' ':
        case 'MediaPlayPause':
        case 'Play':
        case 'Pause':
          e.preventDefault();
          onTogglePlay?.();
          break;

        case 'Escape':
        case 'Backspace':
        case 'GoBack':
        case 'Back':
          e.preventDefault();
          onBack?.();
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          onToggleFullScreen?.();
          break;

        case 'h':
        case 'H':
          e.preventDefault();
          onToggleHud?.();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNext, onPrev, onTogglePlay, onBack, onToggleFullScreen, onToggleHud]);
}
