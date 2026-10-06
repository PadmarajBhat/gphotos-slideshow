import { MediaItem, PlayOrder } from '../types';

/**
 * The order an album plays in, as positions into its item list.
 *
 * Shuffle is a fixed order derived from a seed, not a random pick per slide:
 * every item plays once before any repeats, and saving the seed lets a frame
 * carry on through the same order after the TV is switched off. Each item's
 * place depends only on the seed and its own id, so photos added to the album
 * later slot in without reshuffling the rest.
 */
export function buildSequence(items: MediaItem[], order: PlayOrder, seed: number): number[] {
  const positions = items.map((_, i) => i);
  if (order === 'album') return positions;

  if (order === 'shuffle') {
    const keys = items.map((item) => hash(`${seed}:${item.id}`));
    return positions.sort((a, b) => keys[a] - keys[b] || a - b);
  }

  // By date. Undated items go last either way, in album order.
  const times = items.map((item) => Date.parse(item.mediaMetadata?.creationTime ?? ''));
  const direction = order === 'newest' ? -1 : 1;
  return positions.sort((a, b) => {
    const ta = times[a];
    const tb = times[b];
    if (Number.isNaN(ta) || Number.isNaN(tb)) {
      return Number.isNaN(ta) === Number.isNaN(tb) ? a - b : Number.isNaN(ta) ? 1 : -1;
    }
    return (ta - tb) * direction || a - b;
  });
}

/**
 * A seed for the next shuffled pass, chosen so the pass doesn't open with
 * the item that just closed the previous one.
 */
export function freshSeed(items: MediaItem[], lastItemId?: string, random: () => number = Math.random): number {
  let seed = Math.floor(random() * 2 ** 31);
  for (let tries = 0; tries < 5 && items.length > 1; tries += 1) {
    if (items[buildSequence(items, 'shuffle', seed)[0]]?.id !== lastItemId) break;
    seed = Math.floor(random() * 2 ** 31);
  }
  return seed;
}

/**
 * FNV-1a, then MurmurHash3's finaliser. FNV-1a alone leaves ids that differ
 * only in their last characters (photo1, photo2...) in a narrow band, which
 * clumps neighbouring items together; the finaliser spreads every bit.
 */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
