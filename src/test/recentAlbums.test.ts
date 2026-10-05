import { describe, it, expect } from 'vitest';
import { clearRecentAlbums, loadRecentAlbums, recordRecentAlbum, MAX_RECENT } from '../utils/recentAlbums';

const demo = { key: 'demo', kind: 'demo' as const, title: 'Demo', count: 7, cover: 'https://x/demo.jpg' };
const google = { key: 'google', kind: 'google' as const, title: 'Your Google Photos', count: 617 };
const shared = (n: number) => ({
  key: `shared:https://photos.app.goo.gl/${n}`,
  kind: 'shared' as const,
  title: `Album ${n}`,
  count: 301,
  sharedUrl: `https://photos.app.goo.gl/${n}`,
});

describe('Recently played albums', () => {
  it('starts empty', () => {
    expect(loadRecentAlbums()).toEqual([]);
  });

  it('puts the latest album first', () => {
    recordRecentAlbum(demo, 1);
    recordRecentAlbum(google, 2);
    expect(loadRecentAlbums().map((r) => r.key)).toEqual(['google', 'demo']);
  });

  it('moves a replayed album to the front instead of duplicating it', () => {
    recordRecentAlbum(demo, 1);
    recordRecentAlbum(google, 2);
    recordRecentAlbum(demo, 3);
    expect(loadRecentAlbums().map((r) => r.key)).toEqual(['demo', 'google']);
  });

  it(`keeps only the last ${MAX_RECENT}`, () => {
    [1, 2, 3, 4].forEach((n) => recordRecentAlbum(shared(n), n));
    const keys = loadRecentAlbums().map((r) => r.title);
    expect(keys).toEqual(['Album 4', 'Album 3', 'Album 2']);
  });

  it('remembers the link needed to reload a shared album', () => {
    recordRecentAlbum(shared(9), 1);
    expect(loadRecentAlbums()[0].sharedUrl).toBe('https://photos.app.goo.gl/9');
  });

  it('ignores corrupt or tampered entries', () => {
    localStorage.setItem(
      'gpicshow_recent',
      JSON.stringify([
        { ...demo, playedAt: 1 },
        { key: 'x', kind: 'evil', title: 'x', count: 1, playedAt: 2 },
        { key: 'shared:y', kind: 'shared', title: 'no link', count: 1, playedAt: 3 },
        'garbage',
      ])
    );
    expect(loadRecentAlbums().map((r) => r.key)).toEqual(['demo']);
  });

  it('survives unparseable storage', () => {
    localStorage.setItem('gpicshow_recent', '{not json');
    expect(loadRecentAlbums()).toEqual([]);
  });

  it('can be cleared', () => {
    recordRecentAlbum(demo, 1);
    clearRecentAlbums();
    expect(loadRecentAlbums()).toEqual([]);
  });
});
