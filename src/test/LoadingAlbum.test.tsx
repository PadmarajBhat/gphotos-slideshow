import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoadingAlbum, loadingHint } from '../components/LoadingAlbum';

describe('LoadingAlbum', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts the seconds and says how long to expect', () => {
    render(<LoadingAlbum />);
    expect(screen.getByRole('status')).toHaveTextContent('This usually takes a few seconds.');

    act(() => void vi.advanceTimersByTime(6000));
    expect(screen.getByRole('status')).toHaveTextContent('6s');
    expect(screen.getByRole('status')).toHaveTextContent(/every 700 photos and videos/);
  });

  it('reassures on a very large album', () => {
    expect(loadingHint(20)).toMatch(/up to a minute/);
  });
});
