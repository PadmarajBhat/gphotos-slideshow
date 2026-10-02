import { Album, MediaItem } from '../types';

export const DEMO_ALBUMS: Album[] = [
  {
    id: 'demo-wonders-world',
    title: 'Wonders of the World & Nature',
    mediaItemsCount: '5',
    isDemo: true,
    coverPhotoBaseUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'demo-coastal-serenity',
    title: 'Coastal Serenity & Sunsets',
    mediaItemsCount: '2',
    isDemo: true,
    coverPhotoBaseUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
];

export const DEMO_MEDIA_MAP: Record<string, MediaItem[]> = {
  'demo-wonders-world': [
    {
      id: 'demo-taj-mahal',
      description: 'Morning sunrise at Taj Mahal on the Yamuna riverbank',
      filename: 'taj_mahal_sunrise.jpg',
      baseUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1920&q=85',
      mimeType: 'image/jpeg',
      mediaMetadata: {
        creationTime: '2025-11-14T06:45:00Z',
        width: '1920',
        height: '1080',
        photo: {
          cameraMake: 'Sony',
          cameraModel: 'ILCE-7RM4',
          focalLength: 35,
          apertureFNumber: 2.8,
          isoEquivalent: 100,
          exposureTime: '1/320s',
        },
      },
      location: {
        placeName: 'Taj Mahal, Agra, Uttar Pradesh',
        country: 'India',
        latitude: 27.1751,
        longitude: 78.0421,
      },
    },
    {
      id: 'demo-portrait-mountains',
      description: 'Majestic peaks of the Himalayas (Portrait Aspect Ratio)',
      filename: 'himalayan_peak.jpg',
      // Notice: portrait image to test blur background!
      baseUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=85',
      mimeType: 'image/jpeg',
      mediaMetadata: {
        creationTime: '2025-10-08T15:20:00Z',
        width: '1080',
        height: '1620',
        photo: {
          cameraMake: 'Canon',
          cameraModel: 'EOS R5',
          focalLength: 50,
          apertureFNumber: 4.0,
          isoEquivalent: 200,
          exposureTime: '1/500s',
        },
      },
      location: {
        placeName: 'Yosemite Valley, California',
        country: 'United States',
        latitude: 37.7456,
        longitude: -119.5936,
      },
    },
    {
      id: 'demo-sample-video',
      description: 'Tranquil ocean waves cascading onto shoreline (Sample Video)',
      filename: 'coastal_waves.mp4',
      // High-quality public domain sample video to test video playback completion
      baseUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      mimeType: 'video/mp4',
      mediaMetadata: {
        creationTime: '2026-01-12T11:15:30Z',
        width: '1920',
        height: '1080',
        video: {
          fps: 30,
          status: 'READY',
        },
      },
      location: {
        placeName: 'Big Sur Coastline, California',
        country: 'United States',
        latitude: 36.2704,
        longitude: -121.8081,
      },
    },
    {
      id: 'demo-cherry-blossom',
      description: 'Spring blossom beside historic pagoda in Kyoto',
      filename: 'kyoto_spring.jpg',
      baseUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1920&q=85',
      mimeType: 'image/jpeg',
      mediaMetadata: {
        creationTime: '2026-04-02T09:30:10Z',
        width: '1920',
        height: '1280',
        photo: {
          cameraMake: 'Fujifilm',
          cameraModel: 'X-T4',
          focalLength: 23,
          apertureFNumber: 2.0,
          isoEquivalent: 160,
          exposureTime: '1/640s',
        },
      },
      location: {
        placeName: 'Gion District, Kyoto',
        country: 'Japan',
        latitude: 35.0037,
        longitude: 135.7772,
      },
    },
    {
      id: 'demo-santorini',
      description: 'White architecture overlooking Aegean Sea (4:3 ratio)',
      filename: 'santorini_cliffs.jpg',
      baseUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1400&q=85',
      mimeType: 'image/jpeg',
      mediaMetadata: {
        creationTime: '2025-08-20T18:50:00Z',
        width: '1400',
        height: '1050',
        photo: {
          cameraMake: 'Nikon',
          cameraModel: 'Z7 II',
          focalLength: 28,
          apertureFNumber: 5.6,
          isoEquivalent: 64,
          exposureTime: '1/250s',
        },
      },
      location: {
        placeName: 'Oia, Santorini',
        country: 'Greece',
        latitude: 36.4618,
        longitude: 25.3753,
      },
    },
  ],
  'demo-coastal-serenity': [
    {
      id: 'demo-maldives',
      description: 'Turquoise overwater lagoon in the Indian Ocean',
      filename: 'maldives_lagoon.jpg',
      baseUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1920&q=85',
      mimeType: 'image/jpeg',
      mediaMetadata: {
        creationTime: '2025-12-25T14:10:00Z',
        width: '1920',
        height: '1080',
        photo: {
          cameraMake: 'Sony',
          cameraModel: 'A7 IV',
          focalLength: 24,
          apertureFNumber: 4.0,
          isoEquivalent: 100,
          exposureTime: '1/800s',
        },
      },
      location: {
        placeName: 'North Malé Atoll',
        country: 'Maldives',
        latitude: 4.3547,
        longitude: 73.5707,
      },
    },
    {
      id: 'demo-sunset-beach',
      description: 'Golden hour reflection on tranquil sandy shore',
      filename: 'golden_sunset.jpg',
      baseUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=85',
      mimeType: 'image/jpeg',
      mediaMetadata: {
        creationTime: '2025-09-19T18:22:15Z',
        width: '1920',
        height: '1280',
      },
      location: {
        placeName: 'Goa Beaches',
        country: 'India',
        latitude: 15.2993,
        longitude: 74.1240,
      },
    },
  ],
};
