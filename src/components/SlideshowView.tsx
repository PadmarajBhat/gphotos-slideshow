import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { MediaItem, SlideshowConfig } from '../types';
import { useSlideshow } from '../hooks/useSlideshow';
import { useTvRemote } from '../hooks/useTvRemote';
import { useWakeLock } from '../hooks/useWakeLock';
import { CLOCK_RHYTHM, WEATHER_RHYTHM, useDetailsRhythm, useOverlayRhythm } from '../hooks/useOverlayRhythm';
import { BlurredBackdrop } from './BlurredBackdrop';
import { AmbientClock } from './AmbientClock';
import { MediaDetails } from './MediaDetails';
import { WeatherWidget } from './WeatherWidget';
import { SlideshowControls } from './SlideshowControls';
import { getTransitionClasses } from '../utils/transitions';
import { videoSources } from '../utils/mediaUrls';

interface SlideshowViewProps {
  items: MediaItem[];
  config: SlideshowConfig;
  /** Identifies the album, so its progress is saved and resumed. */
  albumKey?: string;
  onExit: () => void;
  /** Flip the video sound setting (the control bar's speaker, or M). */
  onToggleSound?: () => void;
}

const CONTROLS_IDLE_MS = 4000;

/** A slow fade, so an overlay leaving or returning never catches the eye. */
const fade = (visible: boolean) =>
  `transition-opacity duration-[1500ms] ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`;

/**
 * A brief `stalled` while a video downloads on home Wi-Fi is normal, so only
 * these timeouts count as a broken video.
 */
/** Never started playing from its last source by now. */
export const VIDEO_START_TIMEOUT_MS = 30000;
/** Never started from a source that has another to fall back to. */
export const VIDEO_SOURCE_TIMEOUT_MS = 20000;
/** Started, then made no progress for this long. */
export const VIDEO_STUCK_MS = 30000;
/** How long something may take to appear before a loading hint shows. */
const HINT_AFTER_S = 2;
const SLOW_AFTER_S = 10;

/** Keys that leave the slideshow; they never get swallowed to turn sound on. */
const EXIT_KEYS = ['Escape', 'Backspace', 'GoBack', 'Back', 'BrowserBack'];

export const SlideshowView: React.FC<SlideshowViewProps> = ({ items, config, albumKey, onExit, onToggleSound }) => {
  const [showHud, setShowHud] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStartedRef = useRef(false);
  const lastProgressRef = useRef(0);

  const {
    currentIndex,
    currentItem,
    isPlaying,
    isVideo,
    activeRandomEffect,
    nextSlide,
    prevSlide,
    togglePlay,
    handleVideoEnded,
    handleMediaError,
    handleMediaLoaded,
    isRetrying,
  } = useSlideshow({
    items,
    durationSeconds: config.durationSeconds,
    transitionEffect: config.transitionEffect,
    order: config.playOrder,
    albumKey,
  });

  // --- Which source of the current video is playing -------------------------
  // Tied to the item, so a new item always starts from its best source.
  const sources = useMemo(() => (currentItem && isVideo ? videoSources(currentItem) : []), [currentItem, isVideo]);
  const [source, setSource] = useState<{ itemId?: string; index: number }>({ index: 0 });
  const sourceIndex = source.itemId === currentItem?.id ? source.index : 0;
  const failedSourceRef = useRef<string | null>(null);

  /** This source failed: try the next one, and skip the video only when none are left. */
  const handleVideoError = useCallback(() => {
    const tag = `${currentItem?.id}:${sourceIndex}`;
    // An error event and a rejected play() often report the same failure.
    if (failedSourceRef.current === tag) return;
    failedSourceRef.current = tag;
    if (sourceIndex < sources.length - 1) {
      videoStartedRef.current = false;
      setSource({ itemId: currentItem?.id, index: sourceIndex + 1 });
    } else {
      handleMediaError();
    }
  }, [currentItem?.id, sourceIndex, sources.length, handleMediaError]);

  // --- Sound ---------------------------------------------------------------
  // Browsers only allow sound once someone has pressed or tapped something on
  // the page. Choosing the album usually counts; after a reload it may not, so
  // the video then plays silently and the next press turns the sound on.
  const [soundBlocked, setSoundBlocked] = useState(false);
  const soundBlockedRef = useRef(false);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Track the real fullscreen state so F11 or Escape cannot desync the icon.
  useEffect(() => {
    const syncFullScreen = () => setIsFullScreen(Boolean(document.fullscreenElement));
    syncFullScreen();
    document.addEventListener('fullscreenchange', syncFullScreen);
    return () => document.removeEventListener('fullscreenchange', syncFullScreen);
  }, []);

  useWakeLock();

  // TV Remote & keyboard bindings
  useTvRemote({
    onNext: nextSlide,
    onPrev: prevSlide,
    onTogglePlay: togglePlay,
    onBack: onExit,
    onToggleFullScreen: toggleFullScreen,
    onToggleHud: () => setShowHud((prev) => !prev),
    onToggleSound,
    enabled: true,
  });

  // Start, pause and resume the video, with sound when allowed.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isPlaying) {
      video.pause();
      return;
    }
    video.muted = !config.videoSound || soundBlockedRef.current;
    video.play()?.catch((err: unknown) => {
      const name = (err as { name?: string } | null)?.name;
      // Superseded by a newer play() or a source change: not a failure.
      if (name === 'AbortError') return;
      if (name === 'NotAllowedError' && !video.muted) {
        soundBlockedRef.current = true;
        setSoundBlocked(true);
        video.muted = true;
        video.play()?.catch(() => handleVideoError());
        return;
      }
      handleVideoError();
    });
  }, [isPlaying, currentItem?.id, sourceIndex, config.videoSound, handleVideoError]);

  // The first press after sound was refused turns it on, rather than doing
  // its usual job (OK would otherwise pause the video). Exit keys still exit.
  useEffect(() => {
    if (!soundBlocked) return;
    const unlock = (event: Event) => {
      const video = videoRef.current;
      if (video && config.videoSound) video.muted = false;
      soundBlockedRef.current = false;
      setSoundBlocked(false);
      if (event instanceof KeyboardEvent && !EXIT_KEYS.includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('pointerdown', unlock, { capture: true });
    return () => {
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('pointerdown', unlock, { capture: true });
    };
  }, [soundBlocked, config.videoSound]);

  // TV browsers hold on to a video's decoder until the element is garbage
  // collected, and have few to spare: after one stuck video, the next could
  // not start at all. Release it the moment the slideshow moves on.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [currentItem?.id, isVideo]);

  // Watchdog: a source that never reaches `playing` gives way to the next.
  useEffect(() => {
    if (!isVideo || !isPlaying) return;
    videoStartedRef.current = false;
    const isLastSource = sourceIndex >= sources.length - 1;
    const timer = setTimeout(
      () => {
        if (!videoStartedRef.current) handleVideoError();
      },
      isLastSource ? VIDEO_START_TIMEOUT_MS : VIDEO_SOURCE_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [isVideo, isPlaying, currentItem?.id, sourceIndex, sources.length, handleVideoError]);

  // A video that started but has stopped moving (the download died) moves on.
  useEffect(() => {
    if (!isVideo || !isPlaying) return;
    lastProgressRef.current = Date.now();
    const timer = setInterval(() => {
      if (videoStartedRef.current && Date.now() - lastProgressRef.current > VIDEO_STUCK_MS) {
        handleMediaError();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [isVideo, isPlaying, currentItem?.id, handleMediaError]);

  // --- Loading hints -------------------------------------------------------
  // Until the photo has loaded or the video has started, count the seconds,
  // so a slow arrival says what is happening instead of showing a blank.
  const [readyId, setReadyId] = useState<string | null>(null);
  const isReady = readyId === currentItem?.id;
  const [waitSeconds, setWaitSeconds] = useState(0);
  useEffect(() => {
    setWaitSeconds(0);
    if (isReady || !currentItem) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setWaitSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isReady, currentItem]);

  const markReady = useCallback(() => {
    setReadyId(currentItem?.id ?? null);
    handleMediaLoaded();
  }, [currentItem?.id, handleMediaLoaded]);

  // Auto-hide controls and cursor after idle. Deliberately not keyed on the
  // slide index: re-running per slide would pop the bar back up forever.
  const handleActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, CONTROLS_IDLE_MS);
  }, []);

  useEffect(() => {
    handleActivity();
    // Listen on the window: on a TV nothing inside the slideshow has focus, so
    // the remote's keys never reach the slideshow's own elements.
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('keydown', handleActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [handleActivity]);

  // Each overlay comes and goes on its own rhythm; any press of the remote or
  // move of the mouse brings them all back while the controls are up.
  const slideMs = config.durationSeconds * 1000;
  const clockVisible = useOverlayRhythm(config.fadeOverlays, slideMs, CLOCK_RHYTHM) || showControls;
  const weatherVisible = useOverlayRhythm(config.fadeOverlays, slideMs, WEATHER_RHYTHM) || showControls;
  const detailsVisible = useDetailsRhythm(config.fadeOverlays, slideMs, currentItem?.id) || showControls;

  if (!currentItem) {
    return (
      <div className="w-full h-viewport flex items-center justify-center bg-slate-950 text-white">
        <p className="text-xl">No media items in this album.</p>
      </div>
    );
  }

  const transitionClass = getTransitionClasses(config.transitionEffect, activeRandomEffect);
  const showLoadingHint = !isReady && !isRetrying && waitSeconds >= HINT_AFTER_S;

  return (
    <div
      onMouseMove={handleActivity}
      onClick={handleActivity}
      // The visible screen, not 100vh: on a phone 100vh reaches under the
      // browser toolbar, hiding the control bar and the bottom overlays.
      className={`relative w-full h-viewport overflow-hidden bg-slate-950 select-none ${
        showControls ? 'cursor-default' : 'cursor-none'
      }`}
    >
      {/* 1. Background Blur Layer for non-fitting aspect ratios */}
      <BlurredBackdrop item={currentItem} />

      {/* 2. Main Foreground Media Layer (Contained full-view) */}
      <div className="absolute inset-0 flex items-center justify-center p-4 lg:p-8 z-10 pointer-events-none">
        {isVideo ? (
          <video
            key={currentItem.id}
            ref={videoRef}
            src={sources[sourceIndex]}
            // Started from the effect above, so sound can be tried first.
            playsInline
            controls={false}
            onEnded={handleVideoEnded}
            onPlaying={() => {
              videoStartedRef.current = true;
              markReady();
            }}
            onError={handleVideoError}
            onTimeUpdate={() => {
              lastProgressRef.current = Date.now();
            }}
            className="max-w-full max-h-full object-contain rounded-lg drop-shadow-2xl pointer-events-auto"
          />
        ) : (
          <img
            key={currentItem.id}
            src={currentItem.baseUrl}
            alt={currentItem.description || currentItem.filename}
            onLoad={markReady}
            onError={handleMediaError}
            className={`max-w-full max-h-full object-contain rounded-lg drop-shadow-2xl ${transitionClass}`}
          />
        )}
      </div>

      {showLoadingHint && (
        <div role="status" className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-6">
          <div className="ambient-glass rounded-2xl px-5 py-3 flex items-center gap-3 text-slate-200 max-w-md">
            <Loader2 className="w-5 h-5 shrink-0 animate-spin text-amber-400" />
            <div className="text-sm sm:text-base">
              <p className="font-semibold">
                {isVideo ? 'Loading video…' : 'Loading photo…'} {waitSeconds}s
              </p>
              <p className="text-xs sm:text-sm text-slate-400">
                {waitSeconds < SLOW_AFTER_S
                  ? isVideo
                    ? 'Videos usually start within a few seconds.'
                    : 'Photos usually appear within a few seconds.'
                  : isVideo
                    ? 'Still on its way. On Wi-Fi a video can take up to half a minute; if it can’t start, the next one will play.'
                    : 'This one is slow to arrive; the next photo follows if it can’t load.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isRetrying && (
        <div role="status" className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-6">
          <div className="ambient-glass rounded-2xl px-5 py-3 text-center text-slate-200 max-w-md">
            <p className="text-sm sm:text-base font-semibold">Photos and videos aren’t loading right now.</p>
            <p className="text-xs sm:text-sm text-slate-400">
              Trying again shortly. If this keeps happening, check the TV’s Wi-Fi.
            </p>
          </div>
        </div>
      )}

      {isVideo && soundBlocked && config.videoSound && (
        <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-30 ambient-glass rounded-full px-4 py-2 text-sm text-slate-100 pointer-events-none">
          Press any button or tap for sound
        </div>
      )}

      {/* 3. Top-Left: Regional Date & Time */}
      {showHud && config.showClock && (
        <div className={`absolute top-4 left-4 sm:top-6 sm:left-6 lg:top-8 lg:left-8 z-20 ${fade(clockVisible)}`}>
          <AmbientClock format12h={config.clockFormat === '12h'} />
        </div>
      )}

      {/* 4 & 5. Bottom-Left: Image Details, Bottom-Right: Local Weather.
          One flex row so they can never overlap; the details give way first.
          A phone is too narrow for both side by side, so there the weather
          sits on top of the details instead. */}
      {showHud && (config.showDetails || config.showWeather) && (
        <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6 lg:inset-x-8 lg:bottom-8 z-20 flex flex-col-reverse gap-2 sm:flex-row sm:items-end sm:gap-4 pointer-events-none">
          {config.showDetails && (
            <div className={`self-start min-w-0 max-w-full ${fade(detailsVisible)}`}>
              <MediaDetails item={currentItem} />
            </div>
          )}
          {config.showWeather && (
            <div className={`ml-auto shrink-0 ${fade(weatherVisible)}`}>
              <WeatherWidget tempUnit={config.tempUnit} />
            </div>
          )}
        </div>
      )}

      {/* 6. Ambient Control Bar (Revealed on remote/mouse activity) */}
      <div
        className={`absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <SlideshowControls
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onPrev={prevSlide}
          onNext={nextSlide}
          onBack={onExit}
          onToggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
          showHud={showHud}
          onToggleHud={() => setShowHud((prev) => !prev)}
          soundOn={config.videoSound}
          onToggleSound={onToggleSound}
          currentIndex={currentIndex}
          totalItems={items.length}
        />
      </div>
    </div>
  );
};
