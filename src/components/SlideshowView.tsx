import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface SlideshowViewProps {
  items: MediaItem[];
  config: SlideshowConfig;
  onExit: () => void;
}

const CONTROLS_IDLE_MS = 4000;

/** A slow fade, so an overlay leaving or returning never catches the eye. */
const fade = (visible: boolean) =>
  `transition-opacity duration-[1500ms] ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`;

/**
 * Google's video server can't send part of a file, so a TV must stream each
 * video from the start; on home Wi-Fi a large clip can take several seconds
 * to begin, and the browser reports `stalled` along the way. That is normal,
 * so only these two timeouts count as a broken video.
 */
/** Never started playing by now. */
export const VIDEO_START_TIMEOUT_MS = 30000;
/** Started, then made no progress for this long. */
export const VIDEO_STUCK_MS = 30000;

export const SlideshowView: React.FC<SlideshowViewProps> = ({ items, config, onExit }) => {
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
  });

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
    enabled: true,
  });

  // Pause/resume has to reach the video element too, not just the timer.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        // Autoplay refused (usually a missing user gesture) - skip rather
        // than sit on a frozen frame.
        handleMediaError();
      });
    } else {
      video.pause();
    }
  }, [isPlaying, currentItem?.id, handleMediaError]);

  // Watchdog: a video that never reaches `playing` is treated as broken.
  useEffect(() => {
    if (!isVideo || !isPlaying) return;
    videoStartedRef.current = false;

    const timer = setTimeout(() => {
      if (!videoStartedRef.current) {
        handleMediaError();
      }
    }, VIDEO_START_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isVideo, isPlaying, currentItem?.id, handleMediaError]);

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
    return () => {
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
      <div className="w-screen h-screen flex items-center justify-center bg-slate-950 text-white">
        <p className="text-xl">No media items in this album.</p>
      </div>
    );
  }

  const transitionClass = getTransitionClasses(config.transitionEffect, activeRandomEffect);

  return (
    <div
      onMouseMove={handleActivity}
      onClick={handleActivity}
      onKeyDown={handleActivity}
      className={`relative w-screen h-screen overflow-hidden bg-slate-950 select-none ${
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
            src={currentItem.videoUrl || currentItem.baseUrl}
            autoPlay
            /* Muted autoplay is the only form browsers reliably allow when the
               slide advances on a timer rather than a user gesture. */
            muted
            playsInline
            controls={false}
            onEnded={handleVideoEnded}
            onPlaying={() => {
              videoStartedRef.current = true;
              handleMediaLoaded();
            }}
            onError={handleMediaError}
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
            onLoad={handleMediaLoaded}
            onError={handleMediaError}
            className={`max-w-full max-h-full object-contain rounded-lg drop-shadow-2xl ${transitionClass}`}
          />
        )}
      </div>

      {isRetrying && (
        <div role="status" className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-6">
          <p className="ambient-glass rounded-2xl px-5 py-3 text-sm sm:text-base text-slate-200 text-center">
            Photos aren’t loading right now. Trying again shortly…
          </p>
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
          currentIndex={currentIndex}
          totalItems={items.length}
        />
      </div>
    </div>
  );
};
