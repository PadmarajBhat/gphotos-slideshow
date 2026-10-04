import { describe, it, expect } from 'vitest';
import { findNextTarget } from '../hooks/useSpatialNavigation';

/** Builds an element that reports a fixed on-screen box. */
function box(name: string, left: number, top: number, width = 100, height = 60): HTMLElement {
  const el = document.createElement('button');
  el.textContent = name;
  el.getBoundingClientRect = () =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;
  return el;
}

describe('findNextTarget (D-pad by on-screen position)', () => {
  // Home screen shape: settings top-right, three Continue cards, demo + photos.
  const settings = box('settings', 560, 0, 40, 40);
  const r1 = box('recent-1', 0, 100);
  const r2 = box('recent-2', 220, 100);
  const r3 = box('recent-3', 440, 100);
  const demo = box('demo', 0, 260, 280, 200);
  const photos = box('photos', 320, 260, 280, 200);
  const all = [settings, r1, r2, r3, demo, photos];

  it('moves along a row', () => {
    expect(findNextTarget(r1, all, 'ArrowRight')).toBe(r2);
    expect(findNextTarget(r2, all, 'ArrowLeft')).toBe(r1);
    expect(findNextTarget(demo, all, 'ArrowRight')).toBe(photos);
  });

  it('drops to the tile directly below rather than a diagonal one', () => {
    expect(findNextTarget(r1, all, 'ArrowDown')).toBe(demo);
    expect(findNextTarget(r3, all, 'ArrowDown')).toBe(photos);
  });

  it('climbs back up to the nearest card above', () => {
    expect(findNextTarget(demo, all, 'ArrowUp')).toBe(r1);
    expect(findNextTarget(photos, all, 'ArrowUp')).toBe(r3);
  });

  it('reaches settings from the top row', () => {
    expect(findNextTarget(r3, all, 'ArrowUp')).toBe(settings);
  });

  it('stays put at an edge', () => {
    expect(findNextTarget(r1, all, 'ArrowLeft')).toBeNull();
    expect(findNextTarget(photos, all, 'ArrowDown')).toBeNull();
  });

  it('ignores keys that are not arrows', () => {
    expect(findNextTarget(r1, all, 'Enter')).toBeNull();
  });

  it('falls back to document order when nothing has been laid out', () => {
    const a = document.createElement('button');
    const b = document.createElement('button');
    const c = document.createElement('button');
    expect(findNextTarget(a, [a, b, c], 'ArrowRight')).toBe(b);
    expect(findNextTarget(c, [a, b, c], 'ArrowUp')).toBe(b);
    expect(findNextTarget(c, [a, b, c], 'ArrowDown')).toBeNull();
  });
});
