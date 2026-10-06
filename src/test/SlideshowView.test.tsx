import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// The weather needs a network and a query client; neither matters here.
vi.mock('../components/WeatherWidget', () => ({ WeatherWidget: () => null }));

import { SlideshowView, VIDEO_START_TIMEOUT_MS, VIDEO_STUCK_MS } from '../components/SlideshowView';
import { DEFAULT_CONFIG } from '../utils/storage';
import { MediaItem } from '../types';

const meta = { creationTime: '2025-01-01T00:00:00Z', width: '1920', height: '1080' };
const video: MediaItem = {
  id: 'v',
  filename: 'clip.mp4',
  baseUrl: 'https://lh3.googleusercontent.com/pw/v=w1920-h1080',
  videoUrl: 'https://lh3.googleusercontent.com/pw/v=dv',
  mimeType: 'video/mp4',
  mediaMetadata: meta,
};
const photo: MediaItem = {
  id: 'p',
  filename: 'photo.jpg',
  baseUrl: 'https://lh3.googleusercontent.com/pw/p=w2560-h1440',
  mimeType: 'image/jpeg',
  mediaMetadata: meta,
};

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('SlideshowView video handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no media playback.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function renderShow() {
    const utils = render(<SlideshowView items={[video, photo]} config={DEFAULT_CONFIG} onExit={vi.fn()} />);
    return { ...utils, videoEl: utils.container.querySelector('video')! };
  }

  // Regression: 'stalled' fires while a large video is still downloading on
  // TV Wi-Fi, and treating it as an error skipped nearly every video.
  it('keeps a video that is merely slow to start', () => {
    const { videoEl } = renderShow();
    fireEvent.stalled(videoEl);
    advance(VIDEO_START_TIMEOUT_MS - 1000);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.playing(videoEl);
    advance(5000);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('plays on as long as the video keeps moving', () => {
    const { videoEl } = renderShow();
    fireEvent.playing(videoEl);
    for (let s = 0; s < 90; s += 1) {
      advance(1000);
      fireEvent.timeUpdate(videoEl);
    }
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('moves on from a video that stops making progress', () => {
    const { videoEl } = renderShow();
    fireEvent.playing(videoEl);
    fireEvent.timeUpdate(videoEl);
    advance(VIDEO_STUCK_MS + 5000);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('moves on from a video that never starts', () => {
    renderShow();
    advance(VIDEO_START_TIMEOUT_MS + 100);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });
});
