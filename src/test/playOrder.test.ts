import { describe, it, expect } from 'vitest';
import { buildSequence, freshSeed } from '../utils/playOrder';
import { MediaItem } from '../types';

const item = (id: string, creationTime = ''): MediaItem => ({
  id,
  filename: `${id}.jpg`,
  baseUrl: `https://lh3.googleusercontent.com/pw/${id}`,
  mimeType: 'image/jpeg',
  mediaMetadata: { creationTime, width: '4', height: '3' },
});

const ids = (items: MediaItem[], sequence: number[]) => sequence.map((i) => items[i].id);

describe('buildSequence', () => {
  const album = [
    item('b', '2021-06-01T00:00:00Z'),
    item('undated'),
    item('c', '2024-01-01T00:00:00Z'),
    item('a', '2019-03-01T00:00:00Z'),
  ];

  it('keeps the album’s own order', () => {
    expect(ids(album, buildSequence(album, 'album', 0))).toEqual(['b', 'undated', 'c', 'a']);
  });

  it('sorts by date either way, with undated items last', () => {
    expect(ids(album, buildSequence(album, 'newest', 0))).toEqual(['c', 'b', 'a', 'undated']);
    expect(ids(album, buildSequence(album, 'oldest', 0))).toEqual(['a', 'b', 'c', 'undated']);
  });

  describe('shuffle', () => {
    const big = Array.from({ length: 200 }, (_, i) => item(`p${i}`));

    it('plays every item exactly once per pass', () => {
      const sequence = buildSequence(big, 'shuffle', 42);
      expect(new Set(sequence).size).toBe(big.length);
      expect(sequence).not.toEqual(buildSequence(big, 'album', 0));
    });

    it('gives the same order for the same seed, so it can resume', () => {
      expect(buildSequence(big, 'shuffle', 7)).toEqual(buildSequence(big, 'shuffle', 7));
      expect(buildSequence(big, 'shuffle', 7)).not.toEqual(buildSequence(big, 'shuffle', 8));
    });

    it('slots newly added photos in without reshuffling the rest', () => {
      const before = ids(big, buildSequence(big, 'shuffle', 3));
      const grown = [...big, item('new-1'), item('new-2')];
      const after = ids(grown, buildSequence(grown, 'shuffle', 3)).filter((id) => !id.startsWith('new'));
      expect(after).toEqual(before);
    });

    it('mixes videos in instead of leaving them where the album put them', () => {
      // Like the real album: all the videos in the last tenth, with ids that
      // differ only in their last characters.
      const clips = big.map((it, i) => (i >= 180 ? { ...it, videoUrl: 'v' } : it));
      const firstVideoAt = (seed: number) => buildSequence(clips, 'shuffle', seed).findIndex((i) => clips[i].videoUrl);
      const seeds = Array.from({ length: 50 }, (_, s) => s * 7919);
      const mean = seeds.reduce((sum, s) => sum + firstVideoAt(s), 0) / seeds.length;
      // 20 videos in 200 items: a fair shuffle puts the first near position 9.
      expect(mean).toBeLessThan(18);
    });
  });
});

describe('freshSeed', () => {
  it('avoids starting a new pass with the item that ended the last one', () => {
    const album = [item('a'), item('b'), item('c')];
    // A random source whose first seed would open with 'a'.
    let calls = 0;
    const seeds = [0, 1, 2, 3, 4, 5].map((s) => s / 10);
    const random = () => seeds[calls++ % seeds.length];
    const first = buildSequence(album, 'shuffle', Math.floor(random() * 2 ** 31));
    calls = 0;
    const lastId = album[first[0]].id;
    const seed = freshSeed(album, lastId, random);
    expect(album[buildSequence(album, 'shuffle', seed)[0]].id).not.toBe(lastId);
  });
});
