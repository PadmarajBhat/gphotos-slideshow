import { PlayOrder } from '../types';

/**
 * Where each album was up to, so a frame switched off at the wall carries on
 * from the same photo, in the same shuffled order. Stored only in this
 * browser's localStorage, and cleared with "Clear recently played".
 */
export interface PlayProgress {
  order: PlayOrder;
  /** The shuffled pass in progress, and the one before it (for Back). */
  seed: number;
  prevSeed: number | null;
  /** The item on screen when last saved. Ids survive the album reloading. */
  itemId: string;
  savedAt: number;
}

const STORAGE_KEY = 'gpicshow_progress';
/** Comfortably more than the Continue row shows. */
const MAX_ALBUMS = 10;
const ORDERS: PlayOrder[] = ['album', 'newest', 'oldest', 'shuffle'];

function readAll(): Record<string, PlayProgress> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isProgress(value: unknown): value is PlayProgress {
  const v = value as Partial<PlayProgress> | null;
  return Boolean(
    v &&
      ORDERS.includes(v.order as PlayOrder) &&
      Number.isFinite(v.seed) &&
      (v.prevSeed === null || Number.isFinite(v.prevSeed)) &&
      typeof v.itemId === 'string' &&
      Number.isFinite(v.savedAt)
  );
}

export function loadProgress(albumKey: string): PlayProgress | null {
  const entry = readAll()[albumKey];
  return isProgress(entry) ? entry : null;
}

export function saveProgress(albumKey: string, progress: Omit<PlayProgress, 'savedAt'>, now = Date.now()): void {
  const all = { ...readAll(), [albumKey]: { ...progress, savedAt: now } };
  const kept = Object.entries(all)
    .filter(([, entry]) => isProgress(entry))
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .slice(0, MAX_ALBUMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Storage full or disabled: resuming is a convenience, not a requirement.
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored to clear.
  }
}
