import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaDetails } from '../components/MediaDetails';
import { MediaItem } from '../types';

const testItem: MediaItem = {
  id: 'media-test-1',
  description: 'Golden Sunset at Anjuna Beach',
  filename: 'sunset.jpg',
  baseUrl: 'https://images.unsplash.com/photo-sunset',
  mimeType: 'image/jpeg',
  mediaMetadata: {
    creationTime: '2025-11-20T17:30:00Z',
    width: '1920',
    height: '1080',
    photo: {
      cameraMake: 'Sony',
      cameraModel: 'A7 IV',
      focalLength: 35,
      apertureFNumber: 1.8,
      isoEquivalent: 100,
    },
  },
  location: {
    placeName: 'Goa, India',
    latitude: 15.58,
    longitude: 73.74,
  },
};

describe('MediaDetails Component', () => {
  it('renders location name when provided', () => {
    render(<MediaDetails item={testItem} />);
    expect(screen.getByText('Goa, India')).toBeInTheDocument();
  });

  it('renders photo description or title', () => {
    render(<MediaDetails item={testItem} />);
    expect(screen.getByText('Golden Sunset at Anjuna Beach')).toBeInTheDocument();
  });

  it('renders camera gear details', () => {
    render(<MediaDetails item={testItem} />);
    expect(screen.getByText(/Sony/)).toBeInTheDocument();
    expect(screen.getByText(/35mm/)).toBeInTheDocument();
    expect(screen.getByText(/ƒ\/1.8/)).toBeInTheDocument();
    expect(screen.getByText(/ISO 100/)).toBeInTheDocument();
  });
});
