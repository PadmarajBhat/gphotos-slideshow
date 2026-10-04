import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotosPanel } from '../components/PhotosPanel';
import { AmbientStatus, OFFLINE_STATUS } from '../api/ambient';

const status = (overrides: Partial<AmbientStatus>): AmbientStatus => ({ ...OFFLINE_STATUS, ...overrides });

function renderPanel(s: AmbientStatus, extra: Partial<React.ComponentProps<typeof PhotosPanel>> = {}) {
  const onConnect = vi.fn().mockResolvedValue(undefined);
  const onPlay = vi.fn();
  const utils = render(
    <PhotosPanel status={s} itemCount={617} onConnect={onConnect} onPlay={onPlay} {...extra} />
  );
  return { ...utils, onConnect, onPlay };
}

describe('PhotosPanel (right side of the home screen)', () => {
  it('requests a pairing code by itself, with no clicks', () => {
    const { onConnect } = renderPanel(status({ phase: 'disconnected' }));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Getting a code/)).toBeInTheDocument();
  });

  it('does not hammer Google when it keeps seeing "disconnected"', () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const props = { itemCount: 0, onConnect, onPlay: vi.fn() };
    const { rerender } = render(<PhotosPanel status={status({ phase: 'disconnected' })} {...props} />);
    rerender(<PhotosPanel status={status({ phase: 'pairing' })} {...props} />);
    rerender(<PhotosPanel status={status({ phase: 'disconnected' })} {...props} />);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  const pairing = status({ phase: 'pairing', userCode: 'HXFZ-JKTQ', verificationUrl: 'https://www.google.com/device' });

  it('shows the QR and the code while pairing', () => {
    const { container } = renderPanel(pairing);
    expect(screen.getByText('Scan or tap to show your photos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pairing code HXFZ-JKTQ/ })).toHaveTextContent('HXFZ-JKTQ');
    expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
  });

  it("makes the QR tappable, since a phone can't scan its own screen", () => {
    renderPanel(pairing);
    const link = screen.getByRole('link', { name: 'Open Google to enter the code' });
    expect(link).toHaveAttribute('href', 'https://www.google.com/device');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('copies the code when tapped, ready to paste on the Google page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderPanel(pairing);
    fireEvent.click(screen.getByRole('button', { name: /Pairing code/ }));

    expect(writeText).toHaveBeenCalledWith('HXFZ-JKTQ');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('switches to the album-choice QR once paired, also tappable', () => {
    renderPanel(status({ phase: 'awaiting_sources', settingsUri: 'https://photos.google.com/frame/abc' }));
    expect(screen.getByText('Now pick your albums')).toBeInTheDocument();
    expect(screen.getByLabelText('Scan to choose albums')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Google Photos to choose albums' })).toHaveAttribute(
      'href',
      'https://photos.google.com/frame/abc'
    );
  });

  it('becomes a playable Google Photos tile when ready', () => {
    const { onPlay } = renderPanel(status({ phase: 'ready', itemCount: 617 }), { cover: 'https://x/c.jpg' });
    const tile = screen.getByRole('button', { name: /Play your Google Photos, 617/ });
    expect(tile).toHaveAttribute('data-nav');
    fireEvent.click(tile);
    expect(onPlay).toHaveBeenCalled();
  });

  it('offers a retry on error, without retrying on its own', () => {
    const { onConnect } = renderPanel(status({ phase: 'error', message: 'invalid_scope' }));
    expect(screen.getByRole('alert')).toHaveTextContent('invalid_scope');
    expect(onConnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('says so plainly when the photo service is unreachable', () => {
    renderPanel(status({ phase: 'offline' }));
    expect(screen.getByText(/unavailable right now/)).toBeInTheDocument();
  });
});
