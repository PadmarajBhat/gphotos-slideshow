import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWakeLock } from '../hooks/useWakeLock';

function installWakeLock() {
  const sentinels: { released: boolean; release: ReturnType<typeof vi.fn> }[] = [];
  const request = vi.fn(async () => {
    const s = { released: false, release: vi.fn(async () => void (s.released = true)) };
    sentinels.push(s);
    return s;
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinels };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useWakeLock', () => {
  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('keeps the screen on while the slideshow is showing, and lets go after', async () => {
    const { request, sentinels } = installWakeLock();
    const { unmount } = renderHook(() => useWakeLock());
    await act(async () => {});

    expect(request).toHaveBeenCalledWith('screen');
    unmount();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it('takes the lock back when the tab returns, since the browser drops it', async () => {
    const { request, sentinels } = installWakeLock();
    renderHook(() => useWakeLock());
    await act(async () => {});

    sentinels[0].released = true; // what the browser does on hide
    await act(async () => setVisibility('hidden'));
    await act(async () => setVisibility('visible'));

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing on browsers without it', () => {
    expect(() => renderHook(() => useWakeLock())).not.toThrow();
  });
});
