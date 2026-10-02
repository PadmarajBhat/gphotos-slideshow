import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmbientSetup } from '../components/AmbientSetup';
import { AmbientStatus, OFFLINE_STATUS } from '../api/ambient';

function renderSetup(overrides: Partial<AmbientStatus> = {}) {
  const onClose = vi.fn();
  const onConnect = vi.fn();
  const onDisconnect = vi.fn();
  const utils = render(
    <AmbientSetup
      status={{ ...OFFLINE_STATUS, ...overrides }}
      onClose={onClose}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
    />
  );
  return { ...utils, onClose, onConnect, onDisconnect };
}

describe('AmbientSetup pairing flow', () => {
  it('explains how to start the helper when it is not running', () => {
    renderSetup({ phase: 'offline' });
    expect(screen.getByText(/helper is not running/i)).toBeInTheDocument();
  });

  it('shows the missing-credentials instructions verbatim', () => {
    renderSetup({ phase: 'unconfigured', message: 'Missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
    expect(screen.getByText(/Missing GOOGLE_CLIENT_ID/)).toBeInTheDocument();
  });

  it('offers pairing with numbered steps when disconnected', () => {
    const { onConnect } = renderSetup({ phase: 'disconnected' });

    expect(screen.getByText(/Select Pair This Frame below/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pair This Frame/ }));
    expect(onConnect).toHaveBeenCalled();
  });

  it('renders the user code and a scannable QR while pairing', () => {
    const { container } = renderSetup({
      phase: 'pairing',
      userCode: 'HXFZ-JKTQ',
      verificationUrl: 'https://www.google.com/device',
    });

    expect(screen.getByText('HXFZ-JKTQ')).toBeInTheDocument();
    expect(screen.getByText('https://www.google.com/device')).toBeInTheDocument();
    // The QR is inline SVG so it works on a TV with no network image loading.
    const qr = container.querySelector('svg[role="img"]');
    expect(qr).toBeInTheDocument();
    expect(qr?.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(50);
  });

  it('prompts for album selection once paired', () => {
    const { container } = renderSetup({
      phase: 'awaiting_sources',
      settingsUri: 'https://photos.google.com/settings/device/abc123',
    });

    expect(screen.getByText('Paired')).toBeInTheDocument();
    expect(screen.getByText(/choose which albums/i)).toBeInTheDocument();
    expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
  });

  it('reports the item count and allows disconnecting when ready', () => {
    const { onDisconnect } = renderSetup({
      phase: 'ready',
      itemCount: 617,
      deviceName: 'Living Room TV',
      mediaSourcesSet: true,
    });

    expect(screen.getByText(/617 photos & videos/)).toBeInTheDocument();
    expect(screen.getByText(/Connected as Living Room TV/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Disconnect This Frame/ }));
    expect(onDisconnect).toHaveBeenCalled();
  });

  it('surfaces an error with a retry', () => {
    const { onConnect } = renderSetup({ phase: 'error', message: 'Ambient API 403: insufficient scope' });

    expect(screen.getByRole('alert')).toHaveTextContent('insufficient scope');
    fireEvent.click(screen.getByRole('button', { name: /Try Again/ }));
    expect(onConnect).toHaveBeenCalled();
  });

  it('traps focus and closes on Escape', () => {
    const { onClose, container } = renderSetup({ phase: 'disconnected' });
    const panel = container.querySelector('[role="dialog"] > div') as HTMLElement;

    expect(panel.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
