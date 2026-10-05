import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../api/inbox', async () => {
  const actual = await vi.importActual<typeof import('../api/inbox')>('../api/inbox');
  return { ...actual, sendAlbumToFrame: vi.fn() };
});

import { SendToFrame } from '../components/SendToFrame';
import { sendAlbumToFrame } from '../api/inbox';

function typeLink(value: string) {
  fireEvent.change(screen.getByLabelText('Shared album link'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /Send to TV/ }));
}

describe('SendToFrame (the page the QR opens on a phone)', () => {
  afterEach(() => vi.clearAllMocks());

  it('explains how to get a shared link', () => {
    render(<SendToFrame code="ABCDEFGH" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Send an album to your TV');
    expect(screen.getByText(/Share → Create link/)).toBeInTheDocument();
    expect(screen.getByText(/ABCD-EFGH/)).toBeInTheDocument();
  });

  it('sends the link with the code from the QR, then confirms', async () => {
    vi.mocked(sendAlbumToFrame).mockResolvedValueOnce();
    render(<SendToFrame code="ABCDEFGH" />);

    typeLink('https://photos.app.goo.gl/SjfyPTNv2Ccz4Swf7');

    expect(await screen.findByText('Sent')).toBeInTheDocument();
    expect(sendAlbumToFrame).toHaveBeenCalledWith('ABCDEFGH', 'https://photos.app.goo.gl/SjfyPTNv2Ccz4Swf7');
  });

  it('catches a wrong link before sending anything', () => {
    render(<SendToFrame code="ABCDEFGH" />);
    typeLink('https://example.com/photos');
    expect(screen.getByRole('alert')).toHaveTextContent(/Google Photos shared link/);
    expect(sendAlbumToFrame).not.toHaveBeenCalled();
  });

  it('shows the reason when the TV’s code has expired', async () => {
    vi.mocked(sendAlbumToFrame).mockRejectedValueOnce(new Error('This code has expired. Scan the new QR code on your TV.'));
    render(<SendToFrame code="ABCDEFGH" />);

    typeLink('https://photos.app.goo.gl/abc');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Scan the new QR/);
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
  });
});
