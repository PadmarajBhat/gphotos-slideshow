import React, { useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { X, Link2, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

interface SharedAlbumModalProps {
  onClose: () => void;
  error?: string | null;
  onLoadSharedAlbum: (url: string) => void;
  isLoading?: boolean;
}

export const SharedAlbumModal: React.FC<SharedAlbumModalProps> = ({
  onClose,
  error,
  onLoadSharedAlbum,
  isLoading = false,
}) => {
  const [sharedUrl, setSharedUrl] = useState('');
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sharedUrl.trim()) {
      onLoadSharedAlbum(sharedUrl.trim());
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <h2 id="shared-title" className="text-xl font-bold">
              Shared Album Link
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition tv-focus-target"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-200 leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-200 leading-relaxed">
            💡 <strong>No setup:</strong> open an album in Google Photos on your phone or PC, tap{' '}
            <strong>Share → Create Link</strong>, and paste it below.
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="shared-album-url" className="text-xs font-semibold text-slate-300">
              Google Photos Shared Album URL
            </label>
            <input
              id="shared-album-url"
              type="url"
              value={sharedUrl}
              onChange={(e) => setSharedUrl(e.target.value)}
              placeholder="https://photos.app.goo.gl/..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-amber-400 outline-none"
              required
            />
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 leading-relaxed flex flex-col gap-1.5">
            <p>
              <strong className="text-slate-300">Two limits worth knowing.</strong> Google only
              embeds the first few hundred photos in a shared album page, so very large albums
              arrive partly loaded. Videos appear as still thumbnails.
            </p>
            <p>
              For the complete album with playable videos, use{' '}
              <strong className="text-amber-300">Use My Photos</strong> instead.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 w-full py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg tv-focus-target"
          >
            {isLoading ? 'Loading Album...' : 'Play Shared Album'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Nothing is stored. Photos stream straight to this screen.</span>
        </div>
      </div>
    </div>
  );
};
