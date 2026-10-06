import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeScreen, TAGLINE, describeContents } from '../components/HomeScreen';
import { RecentAlbum } from '../utils/recentAlbums';

const recentAlbums: RecentAlbum[] = [
  { key: 'shared:k', kind: 'shared', title: 'Krishna', count: 301, sharedUrl: 'https://photos.app.goo.gl/k', playedAt: 3 },
  { key: 'google', kind: 'google', title: 'Your Google Photos', count: 617, playedAt: 2 },
  { key: 'demo', kind: 'demo', title: 'Demo', count: 7, playedAt: 1 },
];

function renderHome(overrides: Partial<React.ComponentProps<typeof HomeScreen>> = {}) {
  const handlers = {
    onDismissNotice: vi.fn(),
    onPlayDemo: vi.fn(),
    onPlayRecent: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  const utils = render(
    <HomeScreen
      recent={[]}
      demoCover="https://x/demo.jpg"
      demoCount={7}
      rightPanel={<div data-testid="right-panel">QR goes here</div>}
      {...handlers}
      {...overrides}
    />
  );
  return { ...utils, ...handlers };
}

describe('HomeScreen', () => {
  it('keeps the text to a title and one line', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your Photo Frame');
    expect(screen.getByText(TAGLINE)).toBeInTheDocument();
    expect(TAGLINE.split(/[.!?]\s/).length).toBe(1);
  });

  it('offers a single demo, focused on a first visit', () => {
    const { onPlayDemo } = renderHome();
    const demo = screen.getByRole('button', { name: /Try the demo, 7/ });
    expect(document.activeElement).toBe(demo);
    fireEvent.click(demo);
    expect(onPlayDemo).toHaveBeenCalled();
  });

  it('hides the Continue row until something has been played', () => {
    renderHome();
    expect(screen.queryByText('Continue')).not.toBeInTheDocument();
  });

  it('shows recent albums first, with the latest one focused for a one-press resume', () => {
    const { onPlayRecent } = renderHome({ recent: recentAlbums });

    expect(screen.getByText('Continue')).toBeInTheDocument();
    const latest = screen.getByRole('button', { name: /Play Krishna, 301/ });
    expect(document.activeElement).toBe(latest);

    fireEvent.click(latest);
    expect(onPlayRecent).toHaveBeenCalledWith(recentAlbums[0]);
  });

  it('shows whichever panel the app supplies on the right', () => {
    renderHome();
    expect(screen.getByTestId('right-panel')).toHaveTextContent('QR goes here');
  });

  it('moves between tiles with the remote', () => {
    renderHome({ recent: recentAlbums });
    // jsdom has no layout, so navigation follows document order here.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Play Your Google Photos, 617/ }));
  });

  it('opens settings from the gear', () => {
    const { onOpenSettings } = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('shows a dismissible notice', () => {
    const { onDismissNotice } = renderHome({ notice: 'Could not load that album.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load that album.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissNotice).toHaveBeenCalled();
  });

  // Regression: with Continue above both columns, three albums pushed the QR
  // below the bottom of a TV screen, where it could not be scanned.
  it('keeps Continue in the demo’s column, so the QR keeps its full height', () => {
    renderHome({ recent: recentAlbums });
    const column = screen.getByRole('button', { name: /Try the demo/ }).parentElement!;
    expect(column).toContainElement(screen.getByRole('region', { name: 'Continue' }));
    expect(column).not.toContainElement(screen.getByTestId('right-panel'));
  });

  // Regression: the page is locked so the slideshow can't scroll, and this
  // box grew with its content instead, so phones could not scroll at all.
  it('scrolls inside a box the height of the screen', () => {
    const { container } = renderHome({ recent: recentAlbums });
    const box = container.firstElementChild!;
    expect(box).toHaveClass('h-viewport', 'overflow-y-auto');
    expect(box).not.toHaveClass('min-h-screen');
  });
});

describe('Continue card contents', () => {
  const base = { key: 'shared:k', kind: 'shared' as const, title: 'Krishna', count: 687, sharedUrl: 'https://photos.app.goo.gl/k', playedAt: 1 };

  it('says how many photos and videos the album holds', () => {
    render(
      <HomeScreen
        recent={[{ ...base, photos: 627, videos: 60 }]}
        demoCover="https://x/demo.jpg"
        demoCount={7}
        rightPanel={null}
        onDismissNotice={vi.fn()}
        onPlayDemo={vi.fn()}
        onPlayRecent={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    expect(screen.getByText('627 photos · 60 videos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play Krishna, 627 photos · 60 videos' })).toBeInTheDocument();
  });

  it('reads naturally for one of a kind, none of a kind, and older entries', () => {
    expect(describeContents({ ...base, count: 2, photos: 1, videos: 1 })).toBe('1 photo · 1 video');
    expect(describeContents({ ...base, count: 5, photos: 5, videos: 0 })).toBe('5 photos');
    expect(describeContents(base)).toBe('687 items');
  });
});
