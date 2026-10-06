import { describe, it, expect } from 'vitest';
import { clearProgress, loadProgress, saveProgress } from '../utils/playProgress';

const entry = { order: 'shuffle' as const, seed: 42, prevSeed: 7, itemId: 'AF1Qip-x' };

describe('Saved progress', () => {
  it('remembers where each album was', () => {
    saveProgress('shared:a|all', entry, 1);
    saveProgress('demo|all', { ...entry, order: 'album', itemId: 'demo-3' }, 2);
    expect(loadProgress('shared:a|all')).toMatchObject(entry);
    expect(loadProgress('demo|all')?.itemId).toBe('demo-3');
    expect(loadProgress('never-played')).toBeNull();
  });

  it('keeps only the ten most recent albums', () => {
    for (let i = 0; i < 12; i += 1) saveProgress(`album-${i}`, entry, i);
    expect(loadProgress('album-0')).toBeNull();
    expect(loadProgress('album-1')).toBeNull();
    expect(loadProgress('album-11')).not.toBeNull();
  });

  it('ignores anything malformed rather than failing to start', () => {
    localStorage.setItem('gpicshow_progress', JSON.stringify({ x: { order: 'sideways', seed: 'a' } }));
    expect(loadProgress('x')).toBeNull();
    localStorage.setItem('gpicshow_progress', 'not json');
    expect(loadProgress('x')).toBeNull();
  });

  it('is wiped by Clear recently played', () => {
    saveProgress('demo|all', entry, 1);
    clearProgress();
    expect(loadProgress('demo|all')).toBeNull();
  });
});
