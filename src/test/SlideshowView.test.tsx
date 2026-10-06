import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

// The weather needs a network and a query client; neither matters here.
vi.mock('../components/WeatherWidget', () => ({ WeatherWidget: () => null }));

import {
  SlideshowView,
  VIDEO_SOURCE_TIMEOUT_MS,
  VIDEO_START_TIMEOUT_MS,
  VIDEO_STUCK_MS,
} from '../components/SlideshowView';
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
const settle = () => act(async () => {});

describe('SlideshowView video handling', () => {
  let play: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no media playback.
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });
  afterEach(() => {
    // Unmount while the media methods are still stubbed.
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function renderShow(config = DEFAULT_CONFIG) {
    const utils = render(<SlideshowView items={[video, photo]} config={config} onExit={vi.fn()} onToggleSound={vi.fn()} />);
    const videoEl = () => utils.container.querySelector('video')!;
    return { ...utils, videoEl };
  }

  // Regression: 'stalled' fires while a large video is still downloading on
  // TV Wi-Fi, and treating it as an error skipped nearly every video.
  it('keeps a video that is merely slow to start', () => {
    const { videoEl } = renderShow();
    fireEvent.stalled(videoEl());
    advance(VIDEO_SOURCE_TIMEOUT_MS - 1000);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.playing(videoEl());
    advance(5000);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  // Regression: a TV left blank by Google's original file, which phones play.
  it('plays Google’s 1080p stream first, then smaller ones, then the original', () => {
    const { videoEl } = renderShow();
    const tried = [videoEl().getAttribute('src')];
    for (let i = 0; i < 3; i += 1) {
      fireEvent.error(videoEl());
      tried.push(videoEl().getAttribute('src'));
    }
    expect(tried.map((u) => u!.split('=').pop())).toEqual(['m37', 'm22', 'm18', 'dv']);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.error(videoEl());
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('tries the next stream when one never starts', () => {
    const { videoEl } = renderShow();
    advance(VIDEO_SOURCE_TIMEOUT_MS + 100);
    expect(videoEl().getAttribute('src')).toMatch(/=m22$/);
  });

  it('plays on as long as the video keeps moving', () => {
    const { videoEl } = renderShow();
    fireEvent.playing(videoEl());
    for (let s = 0; s < 90; s += 1) {
      advance(1000);
      fireEvent.timeUpdate(videoEl());
    }
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('moves on from a video that stops making progress', () => {
    const { videoEl } = renderShow();
    fireEvent.playing(videoEl());
    fireEvent.timeUpdate(videoEl());
    advance(VIDEO_STUCK_MS + 5000);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('moves on from a video none of whose streams start', () => {
    renderShow();
    for (let i = 0; i < 3; i += 1) advance(VIDEO_SOURCE_TIMEOUT_MS + 100);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    advance(VIDEO_START_TIMEOUT_MS + 100);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  // Regression: one stuck video kept the TV's decoder, so the next was blank.
  it('releases the video decoder when the slideshow moves on', () => {
    const { videoEl } = renderShow();
    const el = videoEl();
    fireEvent.click(screen.getByRole('button', { name: 'Next Slide' }));
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    expect(el.hasAttribute('src')).toBe(false);
  });

  it('plays with sound when the browser allows it', async () => {
    const { videoEl } = renderShow();
    await settle();
    expect(videoEl().muted).toBe(false);
  });

  it('plays silently when sound is refused, and the next press turns it on', async () => {
    play.mockRejectedValueOnce(Object.assign(new Error('needs a gesture'), { name: 'NotAllowedError' }));
    const { videoEl } = renderShow();
    await settle();

    expect(videoEl().muted).toBe(true);
    expect(screen.getByText(/Press any button or tap for sound/)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(videoEl().muted).toBe(false);
    expect(screen.queryByText(/for sound/)).not.toBeInTheDocument();
    // The press only turned the sound on; it didn't also pause.
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('stays silent when video sound is switched off', async () => {
    const { videoEl } = renderShow({ ...DEFAULT_CONFIG, videoSound: false });
    await settle();
    expect(videoEl().muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Turn video sound on' })).toBeInTheDocument();
  });

  it('says how long a slow video has been loading', () => {
    renderShow();
    advance(3000);
    expect(screen.getByRole('status')).toHaveTextContent('Loading video… 3s');
    advance(8000);
    expect(screen.getByRole('status')).toHaveTextContent(/up to half a minute/);
  });

  it('brings the controls back on any remote press, wherever focus is', () => {
    renderShow();
    advance(5000);
    const bar = screen.getByRole('toolbar').parentElement!;
    expect(bar.className).toMatch(/opacity-0/);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(bar.className).toMatch(/opacity-100/);
  });
});
