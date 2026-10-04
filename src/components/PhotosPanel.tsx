import React, { useEffect, useRef } from 'react';
import { AmbientStatus } from '../api/ambient';
import { QrCode } from './QrCode';
import { Loader2, CheckCircle2, Images, CloudOff } from 'lucide-react';

interface PhotosPanelProps {
  status: AmbientStatus;
  itemCount: number;
  cover?: string;
  onConnect: () => Promise<unknown>;
  onPlay: () => void;
}

/**
 * Don't ask Google for a new pairing code more often than this, even if the
 * helper keeps reporting "disconnected" (for example right after one expires).
 */
const AUTO_CONNECT_COOLDOWN_MS = 15000;

const tile =
  'h-full min-h-[260px] rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-4 p-6 text-center';

/**
 * Right-hand side of the home screen. Before pairing it shows the QR so a TV
 * needs no menus; once paired it becomes the user's Google Photos.
 */
export const PhotosPanel: React.FC<PhotosPanelProps> = ({
  status,
  itemCount,
  cover,
  onConnect,
  onPlay,
}) => {
  const lastAttemptRef = useRef(0);

  // Request a pairing code by itself, so the QR is simply there on launch.
  useEffect(() => {
    if (status.phase !== 'disconnected') return;
    const now = Date.now();
    if (now - lastAttemptRef.current < AUTO_CONNECT_COOLDOWN_MS) return;
    lastAttemptRef.current = now;
    onConnect().catch(() => {
      // The helper reports failures through its status.
    });
  }, [status.phase, onConnect]);

  if (status.phase === 'ready') {
    return (
      <button
        data-nav
        onClick={onPlay}
        className="group relative h-full min-h-[260px] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 tv-focus-target text-left"
        aria-label={`Play your Google Photos, ${itemCount} photos and videos`}
      >
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600">
            <Images className="w-16 h-16" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950/95 to-transparent">
          <p className="text-xl lg:text-2xl font-bold text-white">Your Google Photos</p>
          <p className="text-sm lg:text-base text-slate-300">{itemCount} photos and videos</p>
        </div>
      </button>
    );
  }

  if (status.phase === 'pairing' && status.userCode && status.verificationUrl) {
    return (
      <div className={tile} aria-label="Connect Google Photos">
        <QrCode value={status.verificationUrl} size={200} label="Scan to show your photos" />
        <p className="text-lg lg:text-xl font-bold text-white">Scan to show your photos</p>
        <p
          className="text-3xl lg:text-4xl font-black tracking-[0.15em] text-amber-400 font-mono"
          aria-label={`Pairing code ${status.userCode}`}
        >
          {status.userCode}
        </p>
      </div>
    );
  }

  if (status.phase === 'awaiting_sources') {
    return (
      <div className={tile} aria-label="Choose albums">
        {status.settingsUri && <QrCode value={status.settingsUri} size={200} label="Scan to choose albums" />}
        <p className="flex items-center gap-2 text-lg lg:text-xl font-bold text-white">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Now pick your albums
        </p>
      </div>
    );
  }

  if (status.phase === 'error') {
    return (
      <div className={tile}>
        <p role="alert" className="text-sm text-red-300 max-w-sm">
          {status.message ?? 'Connecting to Google Photos failed.'}
        </p>
        <button
          data-nav
          onClick={() => {
            lastAttemptRef.current = Date.now();
            onConnect().catch(() => {});
          }}
          className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl tv-focus-target"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status.phase === 'offline' || status.phase === 'unconfigured') {
    return (
      <div className={tile}>
        <CloudOff className="w-10 h-10 text-slate-600" />
        <p className="text-sm text-slate-400 max-w-xs">
          {status.phase === 'offline'
            ? 'The photo service is unavailable right now.'
            : 'The photo service needs setting up.'}
        </p>
      </div>
    );
  }

  // 'disconnected', or 'pairing' before Google has issued a code.
  return (
    <div className={tile}>
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      <p className="text-sm text-slate-400">Getting a code…</p>
    </div>
  );
};
