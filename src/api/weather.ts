import { WeatherData } from '../types';

interface OpenMeteoResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
  };
}

export function mapWmoCodeToCondition(code: number): {
  text: string;
  icon: WeatherData['icon'];
} {
  if (code === 0) return { text: 'Clear & Sunny', icon: 'sun' };
  if (code >= 1 && code <= 3) return { text: 'Partly Cloudy', icon: 'cloud' };
  if (code === 45 || code === 48) return { text: 'Foggy Mist', icon: 'fog' };
  if (code >= 51 && code <= 55) return { text: 'Light Drizzle', icon: 'rain' };
  if (code >= 61 && code <= 67) return { text: 'Rain Shower', icon: 'rain' };
  if (code >= 71 && code <= 77) return { text: 'Snowy Flurries', icon: 'snow' };
  if (code >= 80 && code <= 82) return { text: 'Rain Showers', icon: 'rain' };
  if (code >= 95 && code <= 99) return { text: 'Thunderstorm', icon: 'thunder' };
  return { text: 'Fair Weather', icon: 'sun' };
}

export async function detectCoordinates(): Promise<{
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
}> {
  // 1. Try Browser Geolocation
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 4000,
          maximumAge: 600000,
        });
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      // Fall through to IP-based location for TV browsers
    }
  }

  // 2. Fallback to free IP geolocation (safe for TVs with no GPS)
  try {
    const res = await fetch('https://freeipapi.com/api/json', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.cityName,
          region: data.regionName,
        };
      }
    }
  } catch {
    // If offline or blocked, fallback to default (New Delhi / IST)
  }

  return { latitude: 28.6139, longitude: 77.2090, city: 'New Delhi', region: 'Delhi' };
}

export async function fetchCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&timezone=auto`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Weather fetch failed: ${response.statusText}`);
  }

  const json: OpenMeteoResponse = await response.json();
  const current = json.current;

  if (!current) {
    throw new Error('No current weather data available');
  }

  const { text, icon } = mapWmoCodeToCondition(current.weather_code);

  return {
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(current.apparent_temperature),
    weatherCode: current.weather_code,
    conditionText: text,
    icon,
    precipitation: current.precipitation,
    humidity: current.relative_humidity_2m,
  };
}
