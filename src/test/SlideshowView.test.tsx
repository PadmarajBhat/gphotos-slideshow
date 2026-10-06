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

  // Regression: on the Bravia some videos played their sound with no picture.
  function fakePlayback(el: HTMLVideoElement, frames: number) {
    Object.defineProperty(el, 'currentTime', { configurable: true, get: () => 5 });
    Object.defineProperty(el, 'getVideoPlaybackQuality', { configurable: true, value: () => ({ totalVideoFrames: frames }) });
  }

  it('switches to a smaller stream when a video plays sound but no picture', () => {
    const { videoEl } = renderShow();
    fakePlayback(videoEl(), 0);
    fireEvent.playing(videoEl());
    advance(1500);
    expect(videoEl().getAttribute('src')).toMatch(/=m22$/);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('leaves a video alone while its picture is showing', () => {
    const { videoEl } = renderShow();
    fakePlayback(videoEl(), 120);
    fireEvent.playing(videoEl());
    advance(3000);
    expect(videoEl().getAttribute('src')).toMatch(/=m37$/);
  });

  it('draws videos without CSS effects, which some TVs cannot composite', () => {
    const { videoEl } = renderShow();
    expect(videoEl().className).not.toMatch(/drop-shadow|rounded/);
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

describe('SlideshowView settings and the remote on the control bar', () => {
  const photo2: MediaItem = { ...photo, id: 'p2', baseUrl: 'https://lh3.googleusercontent.com/pw/p2=w2560-h1440' };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function renderPhotos(props: Partial<React.ComponentProps<typeof SlideshowView>> = {}) {
    const onOpenSettings = vi.fn();
    const utils = render(
      <SlideshowView items={[photo, photo2]} config={DEFAULT_CONFIG} onExit={vi.fn()} onOpenSettings={onOpenSettings} {...props} />
    );
    return { ...utils, onOpenSettings };
  }
  const press = (key: string) => fireEvent.keyDown(document.activeElement ?? window, { key });

  it('opens Settings from the gear on the bar, or with Menu or S', () => {
    const { onOpenSettings } = renderPhotos();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    press('ContextMenu');
    press('s');
    expect(onOpenSettings).toHaveBeenCalledTimes(3);
  });

  it('pauses while Settings is open, leaves its keys alone, and carries on after', () => {
    const { rerender } = renderPhotos();
    rerender(<SlideshowView items={[photo, photo2]} config={DEFAULT_CONFIG} onExit={vi.fn()} suspended />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    press('ArrowRight');
    advance(60_000);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    rerender(<SlideshowView items={[photo, photo2]} config={DEFAULT_CONFIG} onExit={vi.fn()} suspended={false} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('reaches the bar with Down, moves along it with Left and Right, and leaves with Up', () => {
    renderPhotos();
    press('ArrowDown');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pause' }));

    press('ArrowRight');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next Slide' }));
    // Moving along the bar didn't change the slide.
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    press('ArrowUp');
    press('ArrowRight');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });
});
