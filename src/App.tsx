import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Album, MediaItem, SlideshowConfig } from './types';
import { useAmbientPhotos } from './hooks/useAmbientPhotos';
import { fetchSharedAlbum } from './api/sharedAlbum';
import { DEMO_ALBUMS, DEMO_MEDIA_MAP } from './api/demoData';
import { loadConfig, saveConfig } from './utils/storage';
import { Header } from './components/Header';
import { AlbumGrid } from './components/AlbumGrid';
import { SlideshowView } from './components/SlideshowView';
import { SettingsModal } from './components/SettingsModal';
import { SharedAlbumModal } from './components/SharedAlbumModal';
import { AmbientSetup } from './components/AmbientSetup';
import { Sparkles, Tv, Images } from 'lucide-react';

export const AMBIENT_ALBUM_ID = 'ambient-google-photos';

export const App: React.FC = () => {
  const [config, setConfig] = useState<SlideshowConfig>(loadConfig);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSharedOpen, setIsSharedOpen] = useState(false);
  const [isAmbientOpen, setIsAmbientOpen] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [sharedAlbums, setSharedAlbums] = useState<Album[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(false);
  const sharedMediaRef = useRef<Map<string, MediaItem[]>>(new Map());

  const ambient = useAmbientPhotos();

  // Preferences survive a reload or a TV power-cycle.
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  /**
   * The user's real library appears as a single album. The Ambient API hands
   * back the media the user chose on their phone, not a set of albums.
   */
  const ambientAlbum: Album | null = useMemo(() => {
    if (!ambient.isReady) return null;
    return {
      id: AMBIENT_ALBUM_ID,
      title: 'Your Google Photos',
      coverPhotoBaseUrl: ambient.items[0]?.baseUrl ?? '',
      mediaItemsCount: String(ambient.status.itemCount),
      isDemo: false,
    };
  }, [ambient.isReady, ambient.items, ambient.status.itemCount]);

  const displayedAlbums: Album[] = useMemo(
    () => [...(ambientAlbum ? [ambientAlbum] : []), ...sharedAlbums, ...DEMO_ALBUMS],
    [ambientAlbum, sharedAlbums]
  );

  const activeMediaItems: MediaItem[] = useMemo(() => {
    if (!selectedAlbumId) return [];
    if (selectedAlbumId === AMBIENT_ALBUM_ID) return ambient.items;

    const shared = sharedMediaRef.current.get(selectedAlbumId);
    if (shared) return shared;

    return DEMO_MEDIA_MAP[selectedAlbumId] ?? [];
  }, [selectedAlbumId, ambient.items]);

  const selectedAlbum = displayedAlbums.find((a) => a.id === selectedAlbumId) ?? null;

  const handleSelectAlbum = useCallback(
    (album: Album) => {
      setAlbumError(null);

      const items =
        album.id === AMBIENT_ALBUM_ID
          ? ambient.items
          : sharedMediaRef.current.get(album.id) ?? DEMO_MEDIA_MAP[album.id] ?? [];

      if (items.length === 0) {
        setAlbumError(`"${album.title}" has no photos or videos to show.`);
        return;
      }
      setSelectedAlbumId(album.id);
    },
    [ambient.items]
  );

  const handleExitSlideshow = useCallback(() => setSelectedAlbumId(null), []);

  const handleStartDemo = useCallback(() => {
    setIsDemoActive(true);
    setAlbumError(null);
  }, []);

  const handleLoadSharedAlbum = useCallback(async (url: string) => {
    setIsLoadingShared(true);
    setAlbumError(null);
    try {
      const { album, items } = await fetchSharedAlbum(url);
      sharedMediaRef.current.set(album.id, items);
      setSharedAlbums((prev) => [album, ...prev]);
      setIsSharedOpen(false);
      setSelectedAlbumId(album.id);
    } catch (err: unknown) {
      setAlbumError(err instanceof Error ? err.message : 'Could not load that shared album.');
    } finally {
      setIsLoadingShared(false);
    }
  }, []);

  if (selectedAlbum && activeMediaItems.length > 0) {
    return (
      <SlideshowView items={activeMediaItems} config={config} onExit={handleExitSlideshow} />
    );
  }

  const needsSetupPrompt =
    ambient.status.phase === 'pairing' || ambient.status.phase === 'awaiting_sources';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-y-auto">
      <Header
        ambientPhase={ambient.status.phase}
        isDemoActive={isDemoActive}
        onOpenGooglePhotos={() => setIsAmbientOpen(true)}
        onOpenSharedLink={() => setIsSharedOpen(true)}
        onStartDemo={handleStartDemo}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-8 flex flex-col gap-8">
        {!ambient.isReady && (
          <div className="ambient-glass rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-amber-500/20 shadow-2xl">
            <div className="flex flex-col gap-2 max-w-2xl">
              <span className="text-amber-400 font-bold uppercase tracking-wider text-xs">
                Welcome to LuminaFrame
              </span>
              <h2 className="text-2xl lg:text-3xl font-black text-white">
                Transform your Smart TV into a Google Photos Ambient Canvas
              </h2>
              <p className="text-slate-300 text-sm lg:text-base leading-relaxed">
                Pair this screen with your Google Photos account from your phone to show your own
                photos and videos, or try the curated demo albums right now.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => setIsAmbientOpen(true)}
                className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-2xl flex items-center gap-2 shadow-xl transition tv-focus-target cursor-pointer text-base"
              >
                <Images className="w-5 h-5" />
                <span>{needsSetupPrompt ? 'Finish Setup' : 'Use My Photos'}</span>
              </button>
              <button
                onClick={handleStartDemo}
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-2xl border border-slate-700 flex items-center gap-2 transition tv-focus-target cursor-pointer text-base"
              >
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>Launch Demo Now</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <span>{ambient.isReady ? 'Your Albums' : 'Featured Albums'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select any album to start full-screen slideshow with ambient clock, weather &amp;
              blur backdrop.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800">
            <Tv className="w-4 h-4 text-amber-400" />
            <span>TV Remote: Arrow Keys navigate • OK/Enter opens album • Back exits</span>
          </div>
        </div>

        <AlbumGrid
          albums={displayedAlbums}
          isLoading={ambient.isLoadingItems}
          error={albumError || ambient.itemsError}
          onSelectAlbum={handleSelectAlbum}
          onStartDemo={handleStartDemo}
        />
      </main>

      {isAmbientOpen && (
        <AmbientSetup
          status={ambient.status}
          onClose={() => setIsAmbientOpen(false)}
          onConnect={ambient.connect}
          onDisconnect={ambient.disconnect}
          onUseSharedLink={() => {
            setIsAmbientOpen(false);
            setIsSharedOpen(true);
          }}
        />
      )}

      {isSharedOpen && (
        <SharedAlbumModal
          onClose={() => setIsSharedOpen(false)}
          error={albumError}
          onLoadSharedAlbum={handleLoadSharedAlbum}
          isLoading={isLoadingShared}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          onSaveConfig={setConfig}
        />
      )}
    </div>
  );
};
