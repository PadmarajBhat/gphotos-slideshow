import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MediaItem, SlideshowConfig } from '../types';
import { useSlideshow } from '../hooks/useSlideshow';
import { useTvRemote } from '../hooks/useTvRemote';
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

/** If a video has not begun playing by now, treat it as unplayable. */
const VIDEO_START_TIMEOUT_MS = 15000;

export const SlideshowView: React.FC<SlideshowViewProps> = ({ items, config, onExit }) => {
  const [showHud, setShowHud] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStartedRef = useRef(false);

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
            }}
            onError={handleMediaError}
            onStalled={handleMediaError}
            className="max-w-full max-h-full object-contain rounded-lg drop-shadow-2xl pointer-events-auto"
          />
        ) : (
          <img
            key={currentItem.id}
            src={currentItem.baseUrl}
            alt={currentItem.description || currentItem.filename}
            onError={handleMediaError}
            className={`max-w-full max-h-full object-contain rounded-lg drop-shadow-2xl ${transitionClass}`}
          />
        )}
      </div>

      {/* 3. Top-Left: Regional Date & Time */}
      {showHud && config.showClock && (
        <div className="absolute top-6 left-6 lg:top-8 lg:left-8 z-20 transition-opacity duration-300">
          <AmbientClock format12h={config.clockFormat === '12h'} />
        </div>
      )}

      {/* 4. Bottom-Left: Image Details (Where, When, Camera) */}
      {showHud && config.showDetails && (
        <div className="absolute bottom-6 left-6 lg:bottom-8 lg:left-8 z-20 transition-opacity duration-300">
          <MediaDetails item={currentItem} />
        </div>
      )}

      {/* 5. Bottom-Right: Local Weather Details */}
      {showHud && config.showWeather && (
        <div className="absolute bottom-6 right-6 lg:bottom-8 lg:right-8 z-20 transition-opacity duration-300">
          <WeatherWidget tempUnit={config.tempUnit} />
        </div>
      )}

      {/* 6. Ambient Control Bar (Revealed on remote/mouse activity) */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
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
