import { useEffect, useRef } from 'react';
import { findNextTarget } from './useSpatialNavigation';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'));
}

/**
 * Keeps keyboard and D-pad focus inside a dialog, moves focus in on open and
 * restores it on close, and closes on Escape or the TV Back button. Without
 * this a remote user can tab onto the album grid hidden behind the dialog.
 *
 * A TV remote has arrow keys but no Tab, so the arrows move between the
 * dialog's controls too, scrolling each into view.
 */
export function useFocusTrap<T extends HTMLElement>(onClose: () => void) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    focusables()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || (event.key === 'Backspace' && !isTextEntry(event.target))) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key.startsWith('Arrow')) {
        // Left and Right belong to the caret while typing in a text box.
        if (isTextEntry(event.target) && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
        const items = focusables();
        const active = document.activeElement as HTMLElement | null;
        const next = active && items.includes(active) ? findNextTarget(active, items, event.key) : items[0];
        if (next) {
          event.preventDefault();
          next.focus();
          next.scrollIntoView?.({ block: 'nearest' });
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return containerRef;
}
