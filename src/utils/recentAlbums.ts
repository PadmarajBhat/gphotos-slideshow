/**
 * The last few albums played on this screen, so a TV can resume with one
 * press of OK. Stored only in this browser's localStorage.
 */

export type RecentKind = 'demo' | 'shared' | 'google';

export interface RecentAlbum {
  /** Stable identity: 'demo', 'google', or 'shared:<link>'. */
  key: string;
  kind: RecentKind;
  title: string;
  count: number;
  /** Long-lived cover image. Omitted for Google, whose URLs expire hourly. */
  cover?: string;
  /** Needed to reload a shared album, since its photos aren't stored. */
  sharedUrl?: string;
  playedAt: number;
}

const STORAGE_KEY = 'gpicshow_recent';
export const MAX_RECENT = 3;

const KINDS: RecentKind[] = ['demo', 'shared', 'google'];

function isRecentAlbum(value: unknown): value is RecentAlbum {
  const v = value as Partial<RecentAlbum> | null;
  return Boolean(
    v &&
      typeof v.key === 'string' &&
      KINDS.includes(v.kind as RecentKind) &&
      typeof v.title === 'string' &&
      typeof v.count === 'number' &&
      typeof v.playedAt === 'number' &&
      (v.kind !== 'shared' || typeof v.sharedUrl === 'string')
  );
}

export function loadRecentAlbums(): RecentAlbum[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRecentAlbum)
      .sort((a, b) => b.playedAt - a.playedAt)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Move an album to the front, dropping the oldest beyond the limit. */
export function recordRecentAlbum(entry: Omit<RecentAlbum, 'playedAt'>, now = Date.now()): RecentAlbum[] {
  const next = [
    { ...entry, playedAt: now },
    ...loadRecentAlbums().filter((r) => r.key !== entry.key),
  ].slice(0, MAX_RECENT);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or disabled: resuming is a convenience, not a requirement.
  }
  return next;
}

export function clearRecentAlbums(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored to clear.
  }
}
