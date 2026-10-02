import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BlurredBackdrop } from '../components/BlurredBackdrop';
import { MediaItem } from '../types';

const photoItem: MediaItem = {
  id: 'backdrop-test',
  description: 'Backdrop Test Photo',
  filename: 'test.jpg',
  baseUrl: 'https://images.unsplash.com/photo-1564507592333?w=1200',
  mimeType: 'image/jpeg',
  mediaMetadata: {
    creationTime: '2025-01-01T00:00:00Z',
    width: '1080',
    height: '1920', // Portrait image to test blur backdrop
  },
};

const googlePhotoItem: MediaItem = {
  ...photoItem,
  id: 'google-backdrop',
  baseUrl: 'https://lh3.googleusercontent.com/pw/AbCdEf123456=w2560-h1440',
};

const videoItem: MediaItem = {
  id: 'backdrop-video',
  filename: 'clip.mp4',
  baseUrl: 'https://example.com/clip.mp4',
  videoUrl: 'https://example.com/clip.mp4',
  mimeType: 'video/mp4',
  mediaMetadata: {
    creationTime: '2025-01-01T00:00:00Z',
    width: '1920',
    height: '1080',
    video: { fps: 30, status: 'READY' },
  },
};

describe('BlurredBackdrop Component', () => {
  it('renders the backdrop with blur and scale filters', () => {
    const { container } = render(<BlurredBackdrop item={photoItem} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.className).toContain('blur-3xl');
    expect(img?.className).toContain('scale-110');
  });

  it('requests a small variant so TV hardware does not decode the full image twice', () => {
    const { container } = render(<BlurredBackdrop item={photoItem} />);
    expect(container.querySelector('img')?.src).toBe(
      'https://images.unsplash.com/photo-1564507592333?w=480'
    );
  });

  it('downsizes Google Photos URLs by replacing the size suffix', () => {
    const { container } = render(<BlurredBackdrop item={googlePhotoItem} />);
    expect(container.querySelector('img')?.src).toBe(
      'https://lh3.googleusercontent.com/pw/AbCdEf123456=w480-h270'
    );
  });

  it('renders no backdrop image for videos, which have no still to sample', () => {
    const { container } = render(<BlurredBackdrop item={videoItem} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the vignette overlay gradients', () => {
    const { container } = render(<BlurredBackdrop item={photoItem} />);
    expect(container.querySelector('.bg-vignette')).toBeInTheDocument();
  });
});
