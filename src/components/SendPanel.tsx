import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CloudOff, CheckCircle2 } from 'lucide-react';
import { QrCode } from './QrCode';
import { SendCode, checkInbox, formatCode, requestSendCode, sendPageUrl } from '../api/inbox';

interface SendPanelProps {
  /** Called with a shared-album link the phone just sent. */
  onAlbumLink: (url: string) => void;
}

const INBOX_POLL_MS = 3000;
/** Fetch a new code shortly before the current one expires, so the QR never goes stale. */
const RENEW_BEFORE_MS = 2 * 60 * 1000;
const RETRY_MS = 15000;

const tile =
  'h-full min-h-[260px] tv:min-h-0 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-4 p-6 text-center';

/**
 * Right-hand side of the home screen: a QR the phone scans to send a shared
 * album to this screen, so nothing is typed on a TV.
 */
export const SendPanel: React.FC<SendPanelProps> = ({ onAlbumLink }) => {
  const [code, setCode] = useState<SendCode | null>(null);
  const [failed, setFailed] = useState(false);
  const [received, setReceived] = useState(false);
  const onAlbumLinkRef = useRef(onAlbumLink);
  onAlbumLinkRef.current = onAlbumLink;

  // Get a code, and keep it fresh.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const fetchCode = async () => {
      try {
        const next = await requestSendCode();
        if (cancelled) return;
        setCode(next);
        setFailed(false);
        const renewIn = Math.max(RETRY_MS, Date.parse(next.expiresAt) - Date.now() - RENEW_BEFORE_MS);
        timer = setTimeout(fetchCode, renewIn);
      } catch {
        if (cancelled) return;
        setFailed(true);
        timer = setTimeout(fetchCode, RETRY_MS);
      }
    };

    fetchCode();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [received]);

  // Watch for a link from the phone. Polls even when the page reports
  // itself hidden; TV browsers often do that while showing it.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const url = await checkInbox();
        if (url && !cancelled) {
          setReceived(true);
          onAlbumLinkRef.current(url);
          // The code is spent; fetch a new one for next time.
          setTimeout(() => !cancelled && setReceived(false), 1500);
        }
      } catch {
        // Transient; the next poll retries.
      }
    }, INBOX_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code]);

  if (received) {
    return (
      <div className={tile}>
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        <p className="text-lg font-bold text-white">Album received</p>
      </div>
    );
  }

  if (failed && !code) {
    return (
      <div className={tile}>
        <CloudOff className="w-10 h-10 text-slate-600" />
        <p className="text-sm text-slate-400 max-w-xs">The photo service is unavailable right now.</p>
      </div>
    );
  }

  if (!code) {
    return (
      <div className={tile}>
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const url = sendPageUrl(code.code);
  return (
    <div className={tile} aria-label="Send an album from your phone">
      {/* On a TV the code takes whatever height the panel has, up to 260px,
          so it is never cut off. Also a link: on a phone, tapping opens the
          send page directly. */}
      <div className="w-full flex justify-center tv:flex-1 tv:min-h-0 tv:max-h-[260px]">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          data-nav
          aria-label="Open the send page"
          className="block w-[200px] h-[200px] tv:w-auto tv:h-full aspect-square rounded-xl tv-focus-target"
        >
          <QrCode value={url} size={200} label="Scan to send an album" className="w-full h-full" />
        </a>
      </div>
      <p className="shrink-0 text-lg lg:text-xl font-bold text-white">Scan to send an album</p>
      <p className="shrink-0 text-2xl font-black tracking-[0.15em] text-amber-400 font-mono" aria-label={`Code ${code.code}`}>
        {formatCode(code.code)}
      </p>
    </div>
  );
};
