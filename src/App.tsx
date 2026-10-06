import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MediaItem, SlideshowConfig } from './types';
import { useAmbientPhotos } from './hooks/useAmbientPhotos';
import { SHARED_REFRESH_MS, useSharedAlbumRefresh } from './hooks/useSharedAlbumRefresh';
import { fetchSharedAlbum } from './api/sharedAlbum';
import { DEMO_ALBUM, DEMO_ITEMS } from './api/demoData';
import { loadConfig, saveConfig } from './utils/storage';
import { countMedia, filterMedia, isVideoItem } from './utils/mediaUrls';
import {
  RecentAlbum,
  RecentKind,
  clearRecentAlbums,
  loadRecentAlbums,
  recordRecentAlbum,
} from './utils/recentAlbums';
import { clearProgress } from './utils/playProgress';
import { HomeScreen } from './components/HomeScreen';
import { LoadingAlbum } from './components/LoadingAlbum';
import { SlideshowView } from './components/SlideshowView';
import { SettingsModal } from './components/SettingsModal';
import { SharedAlbumModal } from './components/SharedAlbumModal';
import { PhotosPanel } from './components/PhotosPanel';
import { SendPanel } from './components/SendPanel';
import { SendToFrame } from './components/SendToFrame';
import { AMBIENT_ENABLED } from './api/ambient';

interface Playing {
  key: string;
  kind: RecentKind;
  items: MediaItem[];
}

interface CachedSharedAlbum {
  title: string;
  cover: string;
  items: MediaItem[];
  loadedAt: number;
}

const SHARED_PREFIX = 'shared:';

/** Set when a phone opened the TV's QR code: ?send=CODE. */
function sendCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('send');
}

export const App: React.FC = () => {
  const sendCode = sendCodeFromUrl();
  // A phone that scanned the TV's QR gets the send page, not the frame.
  return sendCode ? <SendToFrame code={sendCode} /> : <FrameApp />;
};

const FrameApp: React.FC = () => {
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
  const activeItems = useMemo(
    () => (playing?.kind === 'google' ? ambient.items : playing?.items ?? []),
    [playing, ambient.items]
  );

  // Photos only, videos only, or both, as chosen in Settings.
  const playableItems = useMemo(() => filterMedia(activeItems, config.mediaFilter), [activeItems, config.mediaFilter]);

  // Stable, so the slideshow's key handlers aren't re-registered every render.
  const toggleSound = useCallback(() => setConfig((c) => ({ ...c, videoSound: !c.videoSound })), []);
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);

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
      ...countMedia(DEMO_ITEMS),
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
    remember({
      key: 'google',
      kind: 'google',
      title: 'Your Google Photos',
      count: ambient.items.length,
      ...countMedia(ambient.items),
    });
  }, [ambient.isReady, ambient.items, remember]);

  /** Loads (or reuses) a shared album and starts it. Throws on failure. */
  const playShared = useCallback(
    async (url: string) => {
      let album = sharedCache.current.get(url);
      if (!album || Date.now() - album.loadedAt > SHARED_REFRESH_MS) {
        setIsLoading(true);
        try {
          const { album: meta, items } = await fetchSharedAlbum(url);
          album = { title: meta.title, cover: meta.coverPhotoBaseUrl, items, loadedAt: Date.now() };
          sharedCache.current.set(url, album);
        } finally {
          setIsLoading(false);
        }
      }

      const key = `${SHARED_PREFIX}${url}`;
      setPlaying({ key, kind: 'shared', items: album.items });
      remember({
        key,
        kind: 'shared',
        title: album.title,
        count: album.items.length,
        ...countMedia(album.items),
        cover: album.cover,
        sharedUrl: url,
      });
    },
    [remember]
  );

  // Keep a long-running shared album fresh without interrupting it.
  const playingSharedUrl = playing?.kind === 'shared' ? playing.key.slice(SHARED_PREFIX.length) : null;
  useSharedAlbumRefresh(playingSharedUrl, ({ album: meta, items }) => {
    if (!playingSharedUrl) return;
    sharedCache.current.set(playingSharedUrl, { title: meta.title, cover: meta.coverPhotoBaseUrl, items, loadedAt: Date.now() });
    setPlaying((current) => (current?.key === `${SHARED_PREFIX}${playingSharedUrl}` ? { ...current, items } : current));
  });

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
    const albumKey = `${playing.key}|${config.mediaFilter}`;
    return (
      <>
        <SlideshowView
          // A new order or filter starts the album afresh in it (or where that
          // filter last was); everything else applies to the running show.
          key={`${albumKey}|${config.playOrder}`}
          // Progress is kept per album and per filter: photos-only and
          // videos-only each remember their own place.
          albumKey={albumKey}
          items={playableItems}
          config={config}
          onExit={() => setPlaying(null)}
          onToggleSound={toggleSound}
          onOpenSettings={openSettings}
          suspended={isSettingsOpen}
        />
        {/* Settings over the slideshow: just the slideshow options, not the
            album and history controls, which belong to the home screen. */}
        {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} config={config} onSaveConfig={setConfig} />
        )}
      </>
    );
  }

  // Resuming "Your Google Photos" only makes sense while this frame is paired.
  const visibleRecent = recent.filter((entry) => entry.kind !== 'google' || ambient.isReady);

  return (
    <>
      <HomeScreen
        recent={visibleRecent}
        demoCover={DEMO_ALBUM.coverPhotoBaseUrl}
        demoCount={DEMO_ITEMS.length}
        rightPanel={
          AMBIENT_ENABLED ? (
            <PhotosPanel
              status={ambient.status}
              itemCount={ambient.items.length || ambient.status.itemCount}
              cover={googleCover}
              onConnect={ambient.connect}
              onPlay={playGoogle}
            />
          ) : (
            <SendPanel
              onAlbumLink={(url) => {
                playShared(url).catch((err: unknown) =>
                  setNotice(err instanceof Error ? err.message : 'Could not load that album.')
                );
              }}
            />
          )
        }
        googleCover={googleCover}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
        onPlayDemo={playDemo}
        onPlayRecent={playRecent}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {isLoading && <LoadingAlbum />}

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
            clearProgress();
            setRecent([]);
          }}
        />
      )}
    </>
  );
};
