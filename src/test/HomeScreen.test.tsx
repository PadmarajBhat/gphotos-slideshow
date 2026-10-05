import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeScreen, TAGLINE } from '../components/HomeScreen';
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
});
