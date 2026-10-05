import React, { useState } from 'react';
import { ClipboardPaste, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { assertSharedAlbumUrl } from '../api/sharedAlbum';
import { formatCode, sendAlbumToFrame } from '../api/inbox';

interface SendToFrameProps {
  code: string;
}

/**
 * The page the TV's QR opens on a phone: paste a shared-album link, send it,
 * and the TV starts the slideshow.
 */
export const SendToFrame: React.FC<SendToFrameProps> = ({ code }) => {
  const [link, setLink] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const canPaste = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      assertSharedAlbumUrl(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That link does not look right.');
      return;
    }
    setState('sending');
    try {
      await sendAlbumToFrame(code, link.trim());
      setState('sent');
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Could not send that link.');
    }
  };

  const paste = async () => {
    try {
      setLink((await navigator.clipboard.readText()).trim());
      setError(null);
    } catch {
      setError('Couldn’t read the clipboard. Long-press the box and choose Paste.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-start justify-center px-5 py-10">
      <div className="w-full max-w-md flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-3xl font-black text-white">Send an album to your TV</h1>
          <p className="mt-2 text-sm text-slate-400">
            In Google Photos, open an album, tap <strong>Share → Create link</strong>, copy it, and paste it here.
          </p>
        </header>

        {state === 'sent' ? (
          <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-slate-900 border border-emerald-500/30 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <p className="text-lg font-bold text-white">Sent</p>
            <p className="text-sm text-slate-400">Your TV will start the slideshow in a few seconds.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="album-link" className="text-xs font-semibold text-slate-300">
              Shared album link
            </label>
            <div className="flex gap-2">
              <input
                id="album-link"
                type="url"
                inputMode="url"
                autoComplete="off"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://photos.app.goo.gl/..."
                className="flex-1 min-w-0 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-base text-white placeholder-slate-500 focus:border-amber-400 outline-none"
              />
              {canPaste && (
                <button
                  type="button"
                  onClick={paste}
                  aria-label="Paste"
                  className="px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
                >
                  <ClipboardPaste className="w-5 h-5" />
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={state === 'sending' || !link.trim()}
              className="mt-2 w-full py-3.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              {state === 'sending' ? 'Sending…' : 'Send to TV'}
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-slate-500">
          Code {formatCode(code)} · Anyone with an album link can view that album.
        </p>
      </div>
    </div>
  );
};
