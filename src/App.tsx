import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MediaItem, SlideshowConfig } from './types';
import { useAmbientPhotos } from './hooks/useAmbientPhotos';
import { fetchSharedAlbum } from './api/sharedAlbum';
import { DEMO_ALBUM, DEMO_ITEMS } from './api/demoData';
import { loadConfig, saveConfig } from './utils/storage';
import { isVideoItem } from './utils/mediaUrls';
import {
  RecentAlbum,
  RecentKind,
  clearRecentAlbums,
  loadRecentAlbums,
  recordRecentAlbum,
} from './utils/recentAlbums';
import { HomeScreen } from './components/HomeScreen';
import { SlideshowView } from './components/SlideshowView';
import { SettingsModal } from './components/SettingsModal';
import { SharedAlbumModal } from './components/SharedAlbumModal';

interface Playing {
  key: string;
  kind: RecentKind;
  items: MediaItem[];
}

interface CachedSharedAlbum {
  title: string;
  cover: string;
  items: MediaItem[];
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<SlideshowConfig>(loadConfig);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSharedOpen, setIsSharedOpen] = useState(false);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [recent, setRecent] = useState<RecentAlbum[]>(loadRecentAlbums);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sharedCache = useRef(new Map<string, CachedSharedAlbum>());

  const ambient = useAmbientPhotos();

  // Preferences survive a reload or a TV power-cycle.
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const googleCover = ambient.items.find((item) => !isVideoItem(item))?.baseUrl;

  // Google media URLs are renewed every 50 minutes, so play the live list
  // rather than a snapshot taken when the slideshow started.
  const activeItems = playing?.kind === 'google' ? ambient.items : playing?.items ?? [];

  // If the source disappears mid-play (for example the frame is unpaired),
  // return home instead of resuming unexpectedly later.
  useEffect(() => {
    if (playing && activeItems.length === 0 && !isLoading) setPlaying(null);
  }, [playing, activeItems.length, isLoading]);

  const remember = useCallback((entry: Omit<RecentAlbum, 'playedAt'>) => {
    setRecent(recordRecentAlbum(entry));
  }, []);

  const playDemo = useCallback(() => {
    setNotice(null);
    setPlaying({ key: 'demo', kind: 'demo', items: DEMO_ITEMS });
    remember({
      key: 'demo',
      kind: 'demo',
      title: 'Demo',
      count: DEMO_ITEMS.length,
      cover: DEMO_ALBUM.coverPhotoBaseUrl,
    });
  }, [remember]);

  const playGoogle = useCallback(() => {
    if (!ambient.isReady || ambient.items.length === 0) {
      setNotice('Your Google Photos are still loading. Try again in a moment.');
      return;
    }
    setNotice(null);
    setPlaying({ key: 'google', kind: 'google', items: [] });
    remember({ key: 'google', kind: 'google', title: 'Your Google Photos', count: ambient.items.length });
  }, [ambient.isReady, ambient.items.length, remember]);

  /** Loads (or reuses) a shared album and starts it. Throws on failure. */
  const playShared = useCallback(
    async (url: string) => {
      let album = sharedCache.current.get(url);
      if (!album) {
        setIsLoading(true);
        try {
          const { album: meta, items } = await fetchSharedAlbum(url);
          album = { title: meta.title, cover: meta.coverPhotoBaseUrl, items };
          sharedCache.current.set(url, album);
        } finally {
          setIsLoading(false);
        }
      }

      const key = `shared:${url}`;
      setPlaying({ key, kind: 'shared', items: album.items });
      remember({
        key,
        kind: 'shared',
        title: album.title,
        count: album.items.length,
        cover: album.cover,
        sharedUrl: url,
      });
    },
    [remember]
  );

  const handleSharedSubmit = useCallback(
    async (url: string) => {
      setSharedError(null);
      try {
        await playShared(url);
        setIsSharedOpen(false);
      } catch (err: unknown) {
        setSharedError(err instanceof Error ? err.message : 'Could not load that shared album.');
      }
    },
    [playShared]
  );

  const playRecent = useCallback(
    async (entry: RecentAlbum) => {
      setNotice(null);
      if (entry.kind === 'demo') return playDemo();
      if (entry.kind === 'google') return playGoogle();
      try {
        await playShared(entry.sharedUrl ?? '');
      } catch (err: unknown) {
        setNotice(err instanceof Error ? err.message : 'Could not load that album.');
      }
    },
    [playDemo, playGoogle, playShared]
  );

  if (playing && activeItems.length > 0) {
    return <SlideshowView items={activeItems} config={config} onExit={() => setPlaying(null)} />;
  }

  // Resuming "Your Google Photos" only makes sense while this frame is paired.
  const visibleRecent = recent.filter((entry) => entry.kind !== 'google' || ambient.isReady);

  return (
    <>
      <HomeScreen
        recent={visibleRecent}
        demoCover={DEMO_ALBUM.coverPhotoBaseUrl}
        demoCount={DEMO_ITEMS.length}
        ambientStatus={ambient.status}
        googleCount={ambient.items.length || ambient.status.itemCount}
        googleCover={googleCover}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
        onPlayDemo={playDemo}
        onPlayGoogle={playGoogle}
        onPlayRecent={playRecent}
        onConnect={ambient.connect}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xl font-bold text-white">Loading album…</p>
        </div>
      )}

      {isSharedOpen && (
        <SharedAlbumModal
          onClose={() => setIsSharedOpen(false)}
          error={sharedError}
          onLoadSharedAlbum={handleSharedSubmit}
          isLoading={isLoading}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          onSaveConfig={setConfig}
          googleConnected={ambient.isReady || ambient.status.phase === 'awaiting_sources'}
          onDisconnectGoogle={() => {
            ambient.disconnect().catch(() => {});
            setIsSettingsOpen(false);
          }}
          onOpenSharedLink={() => {
            setIsSettingsOpen(false);
            setSharedError(null);
            setIsSharedOpen(true);
          }}
          hasRecent={recent.length > 0}
          onClearRecent={() => {
            clearRecentAlbums();
            setRecent([]);
          }}
        />
      )}
    </>
  );
};
