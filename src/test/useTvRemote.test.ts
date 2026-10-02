import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTvRemote } from '../hooks/useTvRemote';

function press(key: string, target?: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (target ?? window).dispatchEvent(event);
  return event;
}

describe('useTvRemote', () => {
  let handlers: {
    onNext: ReturnType<typeof vi.fn>;
    onPrev: ReturnType<typeof vi.fn>;
    onTogglePlay: ReturnType<typeof vi.fn>;
    onBack: ReturnType<typeof vi.fn>;
    onToggleFullScreen: ReturnType<typeof vi.fn>;
    onToggleHud: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    handlers = {
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onTogglePlay: vi.fn(),
      onBack: vi.fn(),
      onToggleFullScreen: vi.fn(),
      onToggleHud: vi.fn(),
    };
  });

  it.each([
    ['ArrowRight', 'onNext'],
    ['MediaTrackNext', 'onNext'],
    ['ArrowLeft', 'onPrev'],
    ['MediaTrackPrevious', 'onPrev'],
    [' ', 'onTogglePlay'],
    ['MediaPlayPause', 'onTogglePlay'],
    ['Escape', 'onBack'],
    ['Backspace', 'onBack'],
    ['f', 'onToggleFullScreen'],
    ['F', 'onToggleFullScreen'],
    ['h', 'onToggleHud'],
    ['H', 'onToggleHud'],
  ])('maps %s to %s', (key, handlerName) => {
    renderHook(() => useTvRemote(handlers));
    press(key);
    expect(handlers[handlerName as keyof typeof handlers]).toHaveBeenCalledTimes(1);
  });

  it('prevents the default browser action for handled keys', () => {
    renderHook(() => useTvRemote(handlers));
    expect(press('ArrowRight').defaultPrevented).toBe(true);
  });

  it('ignores unrelated keys', () => {
    renderHook(() => useTvRemote(handlers));
    press('a');
    expect(Object.values(handlers).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it('does not hijack typing inside a text field', () => {
    renderHook(() => useTvRemote(handlers));
    const input = document.createElement('input');
    document.body.appendChild(input);

    press(' ', input);
    press('Backspace', input);

    expect(handlers.onTogglePlay).not.toHaveBeenCalled();
    expect(handlers.onBack).not.toHaveBeenCalled();
    input.remove();
  });

  it('detaches its listener when disabled', () => {
    renderHook(() => useTvRemote({ ...handlers, enabled: false }));
    press('ArrowRight');
    expect(handlers.onNext).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useTvRemote(handlers));
    unmount();
    press('ArrowRight');
    expect(handlers.onNext).not.toHaveBeenCalled();
  });
});
