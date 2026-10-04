import { RefObject, useEffect } from 'react';

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

function centre(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Picks the element a D-pad press should move to: the nearest candidate in
 * that direction, preferring ones aligned with the current element. Off-axis
 * distance counts double so Down from a top-row card lands on the tile below
 * it, not a closer one diagonally.
 */
export function findNextTarget(
  current: HTMLElement,
  candidates: HTMLElement[],
  key: string
): HTMLElement | null {
  const dir = DIRECTIONS[key];
  if (!dir) return null;

  const measured = candidates.map((el) => ({ el, rect: el.getBoundingClientRect() }));
  const hasLayout = measured.some(({ rect }) => rect.width > 0 || rect.height > 0);

  // No geometry yet (not laid out, or a test environment): use document order.
  if (!hasLayout) {
    const index = candidates.indexOf(current);
    const step = dir[0] + dir[1] > 0 ? 1 : -1;
    return candidates[index + step] ?? null;
  }

  const from = centre(current.getBoundingClientRect());
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const { el, rect } of measured) {
    if (el === current) continue;
    const to = centre(rect);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 1) continue;
    const across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Wires arrow keys to move focus between `[data-nav]` elements inside the
 * container. TV browsers ship no spatial navigation, so without this a remote
 * reaches the first element and nothing else.
 */
export function useSpatialNavigation(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.key in DIRECTIONS)) return;
      // Open dialogs manage their own keys and focus.
      if (document.querySelector('[role="dialog"]')) return;

      const node = containerRef.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>('[data-nav]'));
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      if (!active || !items.includes(active)) {
        event.preventDefault();
        items[0].focus();
        return;
      }

      const next = findNextTarget(active, items, event.key);
      if (next) {
        event.preventDefault();
        next.focus();
        next.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [containerRef]);
}
