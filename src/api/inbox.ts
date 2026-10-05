import { HAS_HELPER, HELPER_URL, getFrameSession } from './ambient';

/**
 * Phone-to-TV album hand-off. The TV shows a one-time code as a QR; the
 * phone opens it, pastes a shared-album link and sends it; the TV picks it
 * up on its next check.
 */

export interface SendCode {
  code: string;
  expiresAt: string;
}

async function call<T>(path: string, init: RequestInit = {}, withSession = true): Promise<T> {
  if (!HAS_HELPER) throw new Error('The photo service is unavailable right now.');
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) ?? {}) };
  if (withSession) headers['X-Frame-Session'] = getFrameSession();

  let res: Response;
  try {
    res = await fetch(`${HELPER_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error('The photo service is unavailable right now.');
  }
  let data: T & { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error('The photo service sent an unexpected reply.');
  }
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
  return data;
}

/** TV: a code to show. The empty body guarantees Content-Length for Cloud Run. */
export function requestSendCode(): Promise<SendCode> {
  return call<SendCode>('/api/send-code', { method: 'POST', body: '' });
}

/** TV: a link the phone has sent, if any. Each link is handed over once. */
export async function checkInbox(): Promise<string | null> {
  const { url } = await call<{ url: string | null }>('/api/inbox');
  return url;
}

/** Phone: deliver a link to the TV that showed this code. */
export async function sendAlbumToFrame(code: string, url: string): Promise<void> {
  await call(
    '/api/send',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, url }) },
    false
  );
}

/** The page the QR opens on the phone. */
export function sendPageUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?send=${encodeURIComponent(code)}`;
}

/** "ABCDEFGH" -> "ABCD-EFGH", easier to read across a room. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
