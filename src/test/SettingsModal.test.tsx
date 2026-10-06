import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../components/SettingsModal';
import { DEFAULT_CONFIG } from '../utils/storage';

function renderModal() {
  const onClose = vi.fn();
  const onSaveConfig = vi.fn();
  const utils = render(
    <SettingsModal onClose={onClose} config={DEFAULT_CONFIG} onSaveConfig={onSaveConfig} />
  );
  return { ...utils, onClose, onSaveConfig };
}

describe('SettingsModal', () => {
  it('saves the edited duration', () => {
    const { onSaveConfig } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: '30s' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/ }));

    expect(onSaveConfig).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: 30 }));
  });

  it('discards edits when cancelled', () => {
    const { onSaveConfig, onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: '60s' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSaveConfig).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('re-reads the saved config each time it is opened', () => {
    const { unmount } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: '60s' }));
    expect(screen.getByRole('button', { name: '60s' })).toHaveAttribute('aria-pressed', 'true');
    unmount();

    // Reopening is a fresh mount, so the abandoned edit is gone.
    renderModal();
    expect(screen.getByRole('button', { name: '10s' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '60s' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles overlay visibility options', () => {
    const { onSaveConfig } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/ }));

    expect(onSaveConfig).toHaveBeenCalledWith(expect.objectContaining({ showWeather: false }));
  });

  it('lets the overlays stay put instead of fading now and then', () => {
    const { onSaveConfig } = renderModal();
    const fade = screen.getByRole('button', { name: /Fade them in and out/ });
    expect(fade).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(fade);
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/ }));

    expect(onSaveConfig).toHaveBeenCalledWith(expect.objectContaining({ fadeOverlays: false }));
  });

  it('moves focus into the dialog on open', () => {
    const { container } = renderModal();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and on the TV Back button', () => {
    const { onClose, container } = renderModal();
    const dialog = container.querySelector('[role="dialog"] > div') as HTMLElement;

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(dialog, { key: 'Backspace' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
