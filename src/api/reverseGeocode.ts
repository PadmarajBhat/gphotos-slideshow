import { MediaLocation } from '../types';

const locationCache = new Map<string, string>();

/**
 * Nominatim's usage policy caps clients at one request per second. A slideshow
 * can change photos far faster than that, so serialise lookups behind a queue
 * with a minimum gap rather than firing one per slide.
 */
const MIN_REQUEST_GAP_MS = 1100;
let requestChain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

/** Cap the cache so a very long-running frame cannot grow it without bound. */
const MAX_CACHE_ENTRIES = 500;

function rememberPlace(key: string, value: string): void {
  if (locationCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = locationCache.keys().next().value;
    if (oldest !== undefined) locationCache.delete(oldest);
  }
  locationCache.set(key, value);
}

function throttle(): Promise<void> {
  const scheduled = requestChain.then(async () => {
    const waitFor = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
    if (waitFor > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitFor));
    }
    lastRequestAt = Date.now();
  });
  requestChain = scheduled.catch(() => undefined);
  return scheduled;
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lon: number
): Promise<MediaLocation> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = locationCache.get(cacheKey);
  if (cached) {
    return { latitude: lat, longitude: lon, placeName: cached };
  }

  try {
    await throttle();

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': navigator?.language || 'en',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const locality = addr.city || addr.town || addr.village || addr.county || addr.state_district;
      const state = addr.state || addr.region;
      const country = addr.country;

      const parts = [locality, state, country].filter(Boolean);
      const formatted = parts.length > 0 ? parts.join(', ') : data.display_name;

      if (formatted) {
        rememberPlace(cacheKey, formatted);
        return {
          latitude: lat,
          longitude: lon,
          placeName: formatted,
          country,
        };
      }
    }
  } catch {
    // Gracefully fallback on network or rate limit
  }

  return {
    latitude: lat,
    longitude: lon,
    placeName: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
  };
}
