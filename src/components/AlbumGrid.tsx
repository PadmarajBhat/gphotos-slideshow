import React, { useCallback, useEffect, useRef } from 'react';
import { Album } from '../types';
import { AlbumCard } from './AlbumCard';
import { Sparkles, AlertCircle } from 'lucide-react';

interface AlbumGridProps {
  albums: Album[];
  isLoading: boolean;
  error?: string | null;
  onSelectAlbum: (album: Album) => void;
  onStartDemo: () => void;
}

const ARROW_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];

/**
 * Number of cards on the first visual row. Browsers do not expose the grid
 * geometry, so infer it from which cards share the top offset.
 */
function countColumns(cards: HTMLElement[]): number {
  if (cards.length === 0) return 1;
  const firstTop = cards[0].offsetTop;
  const columns = cards.filter((card) => card.offsetTop === firstTop).length;
  return Math.max(1, columns);
}

export const AlbumGrid: React.FC<AlbumGridProps> = ({
  albums,
  isLoading,
  error,
  onSelectAlbum,
  onStartDemo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoFocusedRef = useRef(false);

  // Focus the first album once, for TV remotes. Never steal focus from an
  // open dialog, and never yank it back while the user is navigating.
  useEffect(() => {
    if (hasAutoFocusedRef.current || albums.length === 0 || !containerRef.current) return;
    if (document.querySelector('[role="dialog"]')) return;

    const firstButton = containerRef.current.querySelector('button');
    if (firstButton) {
      firstButton.focus();
      hasAutoFocusedRef.current = true;
    }
  }, [albums]);

  /**
   * Chrome and most TV browsers ship no spatial navigation, so the D-pad has
   * to be wired up by hand: without this a remote can reach the first album
   * and no other.
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ARROW_KEYS.includes(event.key) || !containerRef.current) return;

    const cards = Array.from(
      containerRef.current.querySelectorAll<HTMLButtonElement>('[data-album-card]')
    );
    if (cards.length === 0) return;

    const currentIndex = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) {
      event.preventDefault();
      cards[0].focus();
      return;
    }

    const columns = countColumns(cards);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = currentIndex + 1;
        break;
      case 'ArrowLeft':
        nextIndex = currentIndex - 1;
        break;
      case 'ArrowDown':
        nextIndex = currentIndex + columns;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex - columns;
        break;
    }

    if (nextIndex < 0 || nextIndex >= cards.length) return;

    event.preventDefault();
    cards[nextIndex].focus();
    // Older TV browsers do not implement scrollIntoView; focus alone is enough there.
    cards[nextIndex].scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xl font-medium">Fetching Google Photos albums...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 max-w-lg mx-auto text-center gap-4 bg-slate-900/60 rounded-3xl border border-red-500/30">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h3 className="text-xl font-bold text-white">Unable to Load Albums</h3>
        <p className="text-sm text-slate-300">{error}</p>
        <button
          onClick={onStartDemo}
          className="mt-2 px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl flex items-center gap-2 shadow-lg transition tv-focus-target"
        >
          <Sparkles className="w-5 h-5" />
          <span>Launch Demo Album Instead</span>
        </button>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <p className="text-xl text-slate-300 font-medium">No albums found in this account.</p>
        <button
          onClick={onStartDemo}
          className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl flex items-center gap-2 shadow-lg transition tv-focus-target"
        >
          <Sparkles className="w-5 h-5" />
          <span>Explore Demo Albums</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-2"
    >
      {albums.map((album, idx) => (
        <AlbumCard
          key={album.id}
          album={album}
          index={idx}
          onSelect={onSelectAlbum}
        />
      ))}
    </div>
  );
};
