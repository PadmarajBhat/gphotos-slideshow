import { describe, it, expect, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { trackKeyboardMode } from '../utils/keyboardMode';

describe('keyboard mode', () => {
  let stop: () => void = () => {};
  afterEach(() => {
    stop();
    document.documentElement.classList.remove('keyboard-mode');
  });

  it('hides the pointer while the arrow keys are in use, and shows it when the mouse moves', () => {
    stop = trackKeyboardMode();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(document.documentElement).not.toHaveClass('keyboard-mode');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.documentElement).toHaveClass('keyboard-mode');
    fireEvent.mouseMove(window);
    expect(document.documentElement).not.toHaveClass('keyboard-mode');
  });
});
