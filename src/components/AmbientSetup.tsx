import React from 'react';
import { AmbientStatus } from '../api/ambient';
import { QrCode } from './QrCode';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  X,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Images,
} from 'lucide-react';

interface AmbientSetupProps {
  status: AmbientStatus;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({
  n,
  title,
  children,
}) => (
  <div className="flex gap-3">
    <div className="shrink-0 w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center">
      {n}
    </div>
    <div className="flex flex-col gap-1">
      <p className="font-semibold text-slate-100 text-sm">{title}</p>
      <div className="text-xs text-slate-400 leading-relaxed">{children}</div>
    </div>
  </div>
);

export const AmbientSetup: React.FC<AmbientSetupProps> = ({
  status,
  onClose,
  onConnect,
  onDisconnect,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ambient-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              G
            </div>
            <h2 id="ambient-title" className="text-xl font-bold">
              Your Google Photos
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition tv-focus-target"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status.phase === 'offline' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>{status.message}</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              The helper runs on this machine only. It holds your Google credentials, which a
              browser is not allowed to keep, and never sends your photos anywhere.
            </p>
          </div>
        )}

        {status.phase === 'unconfigured' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-100 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <pre className="whitespace-pre-wrap font-sans">{status.message}</pre>
            </div>
          </div>
        )}

        {status.phase === 'disconnected' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Pair this screen with your Google Photos account. You approve it once from your
              phone, then choose which albums it may show.
            </p>
            <div className="flex flex-col gap-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              <Step n={1} title="Select Pair This Frame below">
                The TV will show a short code.
              </Step>
              <Step n={2} title="Enter the code on your phone">
                Scan the QR code, or go to the address shown.
              </Step>
              <Step n={3} title="Pick the albums to display">
                Google Photos asks which albums this frame may use.
              </Step>
            </div>
            {status.message && (
              <p className="text-xs text-amber-300 leading-relaxed">{status.message}</p>
            )}
            <button
              onClick={onConnect}
              className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm shadow-lg transition tv-focus-target"
            >
              Pair This Frame
            </button>
          </div>
        )}

        {status.phase === 'pairing' && (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {status.verificationUrl && (
              <QrCode value={status.verificationUrl} size={180} label="Scan to pair this frame" />
            )}
            <div className="flex flex-col gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <Smartphone className="w-4 h-4" />
                <span>On your phone</span>
              </div>
              <p className="text-xs text-slate-400">
                Scan the code, or open{' '}
                <span className="text-slate-200 font-mono">{status.verificationUrl}</span>
              </p>
              <p className="text-xs text-slate-400">Then enter this code:</p>
              <p className="text-3xl lg:text-4xl font-black tracking-[0.2em] text-white font-mono">
                {status.userCode ?? '...'}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for approval...</span>
              </div>
            </div>
          </div>
        )}

        {status.phase === 'awaiting_sources' && (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {status.settingsUri && (
              <QrCode value={status.settingsUri} size={180} label="Scan to choose albums" />
            )}
            <div className="flex flex-col gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Paired</span>
              </div>
              <p className="text-sm text-slate-200 font-semibold">
                Now choose which albums this frame may show.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan the code to open this frame&apos;s settings in the Google Photos app, then
                select your albums. This screen updates on its own.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for album selection...</span>
              </div>
            </div>
          </div>
        )}

        {status.phase === 'ready' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Connected as {status.deviceName}</span>
            </div>
            <div className="flex items-center gap-2 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              <Images className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white">
                  {status.itemCount} photos &amp; videos
                </span>
                {status.lastRefreshedAt && (
                  <span className="text-xs text-slate-500">
                    Refreshed {new Date(status.lastRefreshedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            {status.settingsUri && (
              <div className="flex items-center gap-4 p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <QrCode value={status.settingsUri} size={96} label="Scan to change albums" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scan to change which albums this frame shows, from the Google Photos app on your
                  phone.
                </p>
              </div>
            )}
            <button
              onClick={onDisconnect}
              className="w-full py-2.5 bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 font-semibold rounded-xl border border-slate-700 hover:border-red-500/40 text-sm transition tv-focus-target"
            >
              Disconnect This Frame
            </button>
          </div>
        )}

        {status.phase === 'error' && (
          <div className="flex flex-col gap-3">
            <div
              role="alert"
              className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-200 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{status.message}</span>
            </div>
            <button
              onClick={onConnect}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm transition tv-focus-target"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            Your photos stream from Google straight to this screen. Nothing is uploaded or stored.
          </span>
        </div>
      </div>
    </div>
  );
};
