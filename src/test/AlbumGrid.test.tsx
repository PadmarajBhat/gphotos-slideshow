import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlbumGrid } from '../components/AlbumGrid';
import { Album } from '../types';

const albums: Album[] = [
  { id: 'a1', title: 'Goa 2025', mediaItemsCount: '12', coverPhotoBaseUrl: '', isDemo: false },
  { id: 'a2', title: 'Kerala', mediaItemsCount: '8', coverPhotoBaseUrl: '', isDemo: false },
  { id: 'a3', title: 'Himalayas', mediaItemsCount: '30', coverPhotoBaseUrl: '', isDemo: true },
];

function renderGrid(overrides: Partial<React.ComponentProps<typeof AlbumGrid>> = {}) {
  const onSelectAlbum = vi.fn();
  const onStartDemo = vi.fn();
  const utils = render(
    <AlbumGrid
      albums={albums}
      isLoading={false}
      onSelectAlbum={onSelectAlbum}
      onStartDemo={onStartDemo}
      {...overrides}
    />
  );
  return { ...utils, onSelectAlbum, onStartDemo };
}

describe('AlbumGrid TV remote navigation', () => {
  it('focuses the first album so a remote has somewhere to start', () => {
    renderGrid();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Goa 2025/ }));
  });

  it('moves focus to the next album on ArrowRight', () => {
    const { container } = renderGrid();
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Kerala/ }));
  });

  it('moves focus back on ArrowLeft', () => {
    const { container } = renderGrid();
    const grid = container.firstChild as HTMLElement;
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Goa 2025/ }));
  });

  it('stays put at the edges instead of wrapping unexpectedly', () => {
    const { container } = renderGrid();
    const grid = container.firstChild as HTMLElement;
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Goa 2025/ }));
  });

  it('opens the focused album with Enter, via native button activation', () => {
    const { onSelectAlbum } = renderGrid();
    fireEvent.click(screen.getByRole('button', { name: /Kerala/ }));
    expect(onSelectAlbum).toHaveBeenCalledWith(expect.objectContaining({ id: 'a2' }));
  });

  it('shows the error state with a demo escape hatch', () => {
    renderGrid({ error: 'Album fetch exploded' });
    expect(screen.getByText('Album fetch exploded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Demo Album Instead/ })).toBeInTheDocument();
  });

  it('does not steal focus while a dialog is open', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    const previous = document.activeElement;
    renderGrid();
    expect(document.activeElement).toBe(previous);

    dialog.remove();
  });
});
