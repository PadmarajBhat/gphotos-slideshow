import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../api/inbox', async () => {
  const actual = await vi.importActual<typeof import('../api/inbox')>('../api/inbox');
  return { ...actual, requestSendCode: vi.fn(), checkInbox: vi.fn() };
});

import { SendPanel } from '../components/SendPanel';
import { checkInbox, requestSendCode } from '../api/inbox';

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

describe('SendPanel (TV side of phone-to-TV)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(requestSendCode).mockResolvedValue({ code: 'ABCDEFGH', expiresAt: inMinutes(15) });
    vi.mocked(checkInbox).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function renderPanel() {
    const onAlbumLink = vi.fn();
    render(<SendPanel onAlbumLink={onAlbumLink} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    return { onAlbumLink };
  }

  it('shows a QR that opens the send page with this TV’s code', async () => {
    await renderPanel();
    const link = screen.getByRole('link', { name: 'Open the send page' });
    expect(link.getAttribute('href')).toMatch(/\?send=ABCDEFGH$/);
    expect(screen.getByText('Scan to send an album')).toBeInTheDocument();
    expect(screen.getByLabelText('Code ABCDEFGH')).toHaveTextContent('ABCD-EFGH');
  });

  it('starts the album as soon as the phone sends one', async () => {
    const { onAlbumLink } = await renderPanel();
    vi.mocked(checkInbox).mockResolvedValueOnce('https://photos.app.goo.gl/abc');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(onAlbumLink).toHaveBeenCalledWith('https://photos.app.goo.gl/abc');
  });

  it('keeps checking without starting anything while the inbox is empty', async () => {
    const { onAlbumLink } = await renderPanel();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(vi.mocked(checkInbox).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(onAlbumLink).not.toHaveBeenCalled();
  });

  it('renews the code before it expires', async () => {
    vi.mocked(requestSendCode)
      .mockResolvedValueOnce({ code: 'ABCDEFGH', expiresAt: inMinutes(3) })
      .mockResolvedValueOnce({ code: 'JKMNPQRS', expiresAt: inMinutes(15) });
    await renderPanel();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(screen.getByLabelText('Code JKMNPQRS')).toBeInTheDocument();
  });

  it('says so plainly when the photo service is unreachable', async () => {
    vi.mocked(requestSendCode).mockRejectedValue(new Error('down'));
    await renderPanel();
    expect(screen.getByText(/unavailable right now/)).toBeInTheDocument();
  });
});
