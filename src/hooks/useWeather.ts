import { useQuery } from '@tanstack/react-query';
import { detectCoordinates, fetchCurrentWeather } from '../api/weather';
import { WeatherData } from '../types';

export function useWeather(tempUnit: 'celsius' | 'fahrenheit' = 'celsius') {
  const { data: locationData } = useQuery({
    queryKey: ['userCoordinates'],
    queryFn: detectCoordinates,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 120,
  });

  const weatherQuery = useQuery({
    queryKey: ['currentWeather', locationData?.latitude, locationData?.longitude],
    queryFn: async (): Promise<WeatherData> => {
      if (!locationData) {
        throw new Error('Coordinates not yet available');
      }
      const raw = await fetchCurrentWeather(locationData.latitude, locationData.longitude);
      return {
        ...raw,
        city: locationData.city,
        region: locationData.region,
      };
    },
    enabled: !!locationData,
    refetchInterval: 1000 * 60 * 15, // Refresh weather every 15 minutes
    staleTime: 1000 * 60 * 10,
  });

  // Convert temperature to requested unit
  const formatTemp = (celsius: number): string => {
    if (tempUnit === 'fahrenheit') {
      const fahr = Math.round((celsius * 9) / 5 + 32);
      return `${fahr}°F`;
    }
    return `${celsius}°C`;
  };

  return {
    ...weatherQuery,
    locationData,
    formatTemp,
  };
}
