export interface PhotoMetadata {
  cameraMake?: string;
  cameraModel?: string;
  focalLength?: number;
  apertureFNumber?: number;
  isoEquivalent?: number;
  exposureTime?: string;
}

export interface VideoMetadata {
  fps?: number;
  status?: string;
}

export interface MediaMetadata {
  creationTime: string;
  width: string;
  height: string;
  photo?: PhotoMetadata;
  video?: VideoMetadata;
}

export interface MediaLocation {
  latitude?: number;
  longitude?: number;
  placeName?: string;
  country?: string;
}

export interface MediaItem {
  id: string;
  description?: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: MediaMetadata;
  filename: string;
  location?: MediaLocation;
  // Video download/streaming URL if video
  videoUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  productUrl?: string;
  coverPhotoBaseUrl: string;
  mediaItemsCount: string;
  isDemo?: boolean;
}

export type TransitionType = 'random' | 'crossfade' | 'ken-burns' | 'slide-left' | 'scale-up';

export interface SlideshowConfig {
  durationSeconds: number;
  transitionEffect: TransitionType;
  tempUnit: 'celsius' | 'fahrenheit';
  clockFormat: '12h' | '24h';
  showDetails: boolean;
  showWeather: boolean;
  showClock: boolean;
}

export interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  conditionText: string;
  icon: 'sun' | 'cloud' | 'rain' | 'snow' | 'thunder' | 'fog';
  precipitation: number;
  humidity: number;
  city?: string;
  region?: string;
}

export interface ClockState {
  timeString: string;
  secondsString: string;
  periodString?: string;
  dateString: string;
  dayName: string;
  timeZone: string;
  cityRegion: string;
}
